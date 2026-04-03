package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"google.golang.org/genai"
)

// Flag represents a single identified legal risk.
type Flag struct {
	Category    string `json:"category"`
	Severity    string `json:"severity"`
	Explanation string `json:"explanation"`
	Quote       string `json:"quote"`
}

// AnalysisResult is the full response from the LLM analysis.
type AnalysisResult struct {
	Severity string `json:"severity"`
	Summary  string `json:"summary"`
	Flags    []Flag `json:"flags"`
}

// Analyzer is the interface the handler depends on (enables test doubles).
type Analyzer interface {
	Analyze(text string) (AnalysisResult, error)
}

const chunkWordSize = 3000

const systemPrompt = `You are a consumer protection legal analyst. Your job is to protect everyday people from predatory legal language. Explain everything as if the reader is 16 years old — no legal jargon, no hedge words like "may" or "could".`

const userPromptTemplate = `Analyze the following Terms of Service or Privacy Policy text.

Look specifically for issues in these 6 categories:
1. Data Selling — selling or sharing user data with third parties for profit
2. Hidden Fees — charges not prominently disclosed
3. Forced Arbitration — clauses that prevent users from suing in court
4. Auto-Renewal — subscriptions that renew without clear reminder
5. Data Deletion Rights — how long data is kept after account closure
6. Third-Party Sharing — data shared with partners or affiliates

Severity guide:
- red: directly harms the user or removes important rights
- yellow: worth knowing but not immediately harmful
- green: standard and acceptable

Return ONLY valid JSON in this exact format, no markdown, no code fences:
{
  "severity": "red|yellow|green",
  "summary": "one sentence plain-English summary of the biggest concern",
  "flags": [
    {
      "category": "one of the 6 categories above",
      "severity": "red|yellow|green",
      "explanation": "one sentence, plain English, max 20 words",
      "quote": "the exact verbatim sentence or clause from the text that triggered this flag, max 200 chars"
    }
  ]
}

If no issues are found, return severity "green", summary "This policy looks standard.", and an empty flags array.
For the quote field, copy the text verbatim — do not paraphrase. If no single sentence captures it, use the most relevant clause.

TEXT TO ANALYZE:
%s`

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
	chunks := ChunkText(text, chunkWordSize)
	if len(chunks) == 0 {
		return AnalysisResult{Severity: "green", Summary: "No text to analyze.", Flags: []Flag{}}, nil
	}

	results := make([]AnalysisResult, len(chunks))
	errs := make([]error, len(chunks))
	var wg sync.WaitGroup

	for i, chunk := range chunks {
		wg.Add(1)
		go func(i int, chunk string) {
			defer wg.Done()
			result, err := g.analyzeChunk(chunk)
			results[i] = result
			errs[i] = err
		}(i, chunk)
	}
	wg.Wait()

	// Return first error encountered
	for _, err := range errs {
		if err != nil {
			return AnalysisResult{}, err
		}
	}

	return MergeResults(results), nil
}

func (g *GeminiClient) analyzeChunk(text string) (AnalysisResult, error) {
	ctx := context.Background()
	prompt := fmt.Sprintf(userPromptTemplate, text)

	contents := []*genai.Content{
		{
			Parts: []*genai.Part{
				{Text: systemPrompt},
			},
			Role: "user",
		},
		{
			Parts: []*genai.Part{
				{Text: "Understood. I will analyze legal text and return only valid JSON."},
			},
			Role: "model",
		},
		{
			Parts: []*genai.Part{
				{Text: prompt},
			},
			Role: "user",
		},
	}

	resp, err := g.client.Models.GenerateContent(ctx, g.model, contents, nil)
	if err != nil {
		return AnalysisResult{}, fmt.Errorf("gemini generate: %w", err)
	}

	raw := strings.TrimSpace(resp.Text())
	// Strip markdown code fences if the model adds them despite instructions
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)

	var result AnalysisResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return AnalysisResult{}, fmt.Errorf("parsing gemini response: %w (raw: %s)", err, raw)
	}
	return result, nil
}

// ChunkText splits text into chunks of at most maxWords words, splitting on paragraph
// boundaries where possible. Exported so it can be tested independently.
func ChunkText(text string, maxWords int) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}

	words := strings.Fields(text)
	if len(words) <= maxWords {
		return []string{text}
	}

	var chunks []string
	start := 0
	for start < len(words) {
		end := start + maxWords
		if end > len(words) {
			end = len(words)
		}
		chunks = append(chunks, strings.Join(words[start:end], " "))
		start = end
	}
	return chunks
}

// SeverityRank maps a severity string to a numeric rank for comparison.
// Exported so tests can verify ordering logic.
func SeverityRank(sev string) int {
	switch sev {
	case "red":
		return 2
	case "yellow":
		return 1
	default:
		return 0
	}
}

// MergeResults combines results from multiple chunks into one, taking the
// highest severity and deduplicating flags by category (first red wins).
func MergeResults(results []AnalysisResult) AnalysisResult {
	if len(results) == 0 {
		return AnalysisResult{Severity: "green", Summary: "No issues found.", Flags: []Flag{}}
	}

	merged := AnalysisResult{Severity: "green", Flags: []Flag{}}
	seen := make(map[string]bool)

	for _, r := range results {
		if SeverityRank(r.Severity) > SeverityRank(merged.Severity) {
			merged.Severity = r.Severity
			merged.Summary = r.Summary
		}
		for _, f := range r.Flags {
			if !seen[f.Category] {
				seen[f.Category] = true
				merged.Flags = append(merged.Flags, f)
			}
		}
	}

	if merged.Summary == "" {
		merged.Summary = "This policy looks standard."
	}

	return merged
}
