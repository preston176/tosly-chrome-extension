package llm_test

import (
	"errors"
	"testing"

	"github.com/tosly/backend/llm"
)

// stubAnalyzer is a test double that records how many times it was called.
type stubAnalyzer struct {
	result llm.AnalysisResult
	err    error
	calls  *int
}

func (s stubAnalyzer) Analyze(string) (llm.AnalysisResult, error) {
	if s.calls != nil {
		*s.calls++
	}
	return s.result, s.err
}

func TestChain_FallsBackOnError(t *testing.T) {
	primaryCalls, fallbackCalls := 0, 0
	chain := llm.NewChain(
		llm.NamedAnalyzer{Name: "primary", Analyzer: stubAnalyzer{err: errors.New("rate limited"), calls: &primaryCalls}},
		llm.NamedAnalyzer{Name: "fallback", Analyzer: stubAnalyzer{result: llm.AnalysisResult{Severity: "red"}, calls: &fallbackCalls}},
	)

	got, err := chain.Analyze("text")
	if err != nil {
		t.Fatalf("expected fallback to succeed, got error: %v", err)
	}
	if got.Severity != "red" {
		t.Fatalf("expected fallback result, got severity %q", got.Severity)
	}
	if primaryCalls != 1 || fallbackCalls != 1 {
		t.Fatalf("expected each provider tried once, got primary=%d fallback=%d", primaryCalls, fallbackCalls)
	}
}

func TestChain_UsesPrimaryWhenItSucceeds(t *testing.T) {
	fallbackCalls := 0
	chain := llm.NewChain(
		llm.NamedAnalyzer{Name: "primary", Analyzer: stubAnalyzer{result: llm.AnalysisResult{Severity: "green"}}},
		llm.NamedAnalyzer{Name: "fallback", Analyzer: stubAnalyzer{result: llm.AnalysisResult{Severity: "red"}, calls: &fallbackCalls}},
	)

	got, err := chain.Analyze("text")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Severity != "green" {
		t.Fatalf("expected primary result green, got %q", got.Severity)
	}
	if fallbackCalls != 0 {
		t.Fatalf("expected fallback not called, got %d calls", fallbackCalls)
	}
}

func TestChain_AllFail(t *testing.T) {
	chain := llm.NewChain(
		llm.NamedAnalyzer{Name: "primary", Analyzer: stubAnalyzer{err: errors.New("boom")}},
		llm.NamedAnalyzer{Name: "fallback", Analyzer: stubAnalyzer{err: errors.New("bang")}},
	)
	if _, err := chain.Analyze("text"); err == nil {
		t.Fatal("expected error when all providers fail")
	}
}
