package llm

import (
	"fmt"
	"log"
)

// NamedAnalyzer pairs an Analyzer with a label used in fallback logging.
type NamedAnalyzer struct {
	Name     string
	Analyzer Analyzer
}

// Chain tries each analyzer in order, falling back to the next when one returns
// an error. The first successful result wins. This lets a free provider (Groq)
// cover for the primary (Gemini) when it is rate-limited or out of credits.
type Chain struct {
	analyzers []NamedAnalyzer
}

// NewChain builds a fallback chain from the given analyzers, in priority order.
func NewChain(analyzers ...NamedAnalyzer) *Chain {
	return &Chain{analyzers: analyzers}
}

func (c *Chain) Analyze(text string) (AnalysisResult, error) {
	var lastErr error
	for _, a := range c.analyzers {
		result, err := a.Analyzer.Analyze(text)
		if err == nil {
			return result, nil
		}
		log.Printf("[llm] provider %q failed: %v", a.Name, err)
		lastErr = err
	}
	if lastErr == nil {
		return AnalysisResult{}, fmt.Errorf("no analyzers configured")
	}
	return AnalysisResult{}, fmt.Errorf("all LLM providers failed; last error: %w", lastErr)
}
