package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	groqEndpoint = "https://api.groq.com/openai/v1/chat/completions"
	// defaultGroqModel is a capable model available on Groq's free tier.
	defaultGroqModel = "llama-3.3-70b-versatile"
	groqTimeout      = 60 * time.Second
)

// GroqClient calls Groq's OpenAI-compatible chat completions API and implements
// Analyzer. It serves as a free-tier fallback when the primary provider is
// rate-limited or out of credits.
type GroqClient struct {
	apiKey string
	model  string
	http   *http.Client
}

// NewGroqClient returns a Groq-backed Analyzer. If model is empty, a free
// default model is used.
func NewGroqClient(apiKey, model string) *GroqClient {
	if model == "" {
		model = defaultGroqModel
	}
	return &GroqClient{
		apiKey: apiKey,
		model:  model,
		http:   &http.Client{Timeout: groqTimeout},
	}
}

func (g *GroqClient) Analyze(text string) (AnalysisResult, error) {
	return analyzeChunks(text, g.analyzeChunk)
}

type groqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqRequest struct {
	Model          string            `json:"model"`
	Messages       []groqMessage     `json:"messages"`
	Temperature    float64           `json:"temperature"`
	ResponseFormat map[string]string `json:"response_format,omitempty"`
}

type groqResponse struct {
	Choices []struct {
		Message groqMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (g *GroqClient) analyzeChunk(text string) (AnalysisResult, error) {
	reqBody := groqRequest{
		Model: g.model,
		Messages: []groqMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: fmt.Sprintf(userPromptTemplate, text)},
		},
		Temperature: 0.2,
		// Ask for JSON mode so the model returns a bare object (the prompt also
		// mentions JSON, which this mode requires).
		ResponseFormat: map[string]string{"type": "json_object"},
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("groq: marshaling request: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), groqTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqEndpoint, bytes.NewReader(payload))
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("groq: building request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+g.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.http.Do(req)
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("groq generate: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("groq: reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return AnalysisResult{}, fmt.Errorf("groq generate: status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var gr groqResponse
	if err := json.Unmarshal(body, &gr); err != nil {
		return AnalysisResult{}, fmt.Errorf("groq: decoding response: %w", err)
	}
	if gr.Error != nil {
		return AnalysisResult{}, fmt.Errorf("groq generate: %s", gr.Error.Message)
	}
	if len(gr.Choices) == 0 {
		return AnalysisResult{}, fmt.Errorf("groq: empty choices in response")
	}

	result, err := parseAnalysisJSON(gr.Choices[0].Message.Content)
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("groq: %w", err)
	}
	return result, nil
}
