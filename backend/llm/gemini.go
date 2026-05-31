package llm

import (
	"context"
	"fmt"

	"google.golang.org/genai"
)

// GeminiClient calls the Gemini API and implements Analyzer.
type GeminiClient struct {
	client *genai.Client
	model  string
}

func NewGeminiClient(apiKey string) (*GeminiClient, error) {
	ctx := context.Background()
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, fmt.Errorf("creating gemini client: %w", err)
	}
	return &GeminiClient{client: client, model: "gemini-2.5-flash"}, nil
}

func (g *GeminiClient) Analyze(text string) (AnalysisResult, error) {
	return analyzeChunks(text, g.analyzeChunk)
}

func (g *GeminiClient) analyzeChunk(text string) (AnalysisResult, error) {
	ctx := context.Background()
	prompt := fmt.Sprintf(userPromptTemplate, text)

	contents := []*genai.Content{
		{
			Parts: []*genai.Part{{Text: systemPrompt}},
			Role:  "user",
		},
		{
			Parts: []*genai.Part{{Text: "Understood. I will analyze legal text and return only valid JSON."}},
			Role:  "model",
		},
		{
			Parts: []*genai.Part{{Text: prompt}},
			Role:  "user",
		},
	}

	resp, err := g.client.Models.GenerateContent(ctx, g.model, contents, nil)
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("gemini generate: %w", err)
	}

	result, err := parseAnalysisJSON(resp.Text())
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("gemini: %w", err)
	}
	return result, nil
}
