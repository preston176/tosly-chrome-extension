package llm_test

import (
	"strings"
	"testing"

	"github.com/tosly/backend/llm"
)

func TestChunkText_ShortText(t *testing.T) {
	text := "This is a short terms of service document."
	chunks := llm.ChunkText(text, 500)

	if len(chunks) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(chunks))
	}
	if chunks[0] != text {
		t.Fatalf("unexpected chunk content: %q", chunks[0])
	}
}

func TestChunkText_LongText(t *testing.T) {
	// Build a text that is definitely over 2 chunk-words worth
	var sb strings.Builder
	for i := 0; i < 200; i++ {
		sb.WriteString("word ")
	}
	text := sb.String()

	chunks := llm.ChunkText(text, 50) // 50 words per chunk → expect 4 chunks

	if len(chunks) < 2 {
		t.Fatalf("expected multiple chunks, got %d", len(chunks))
	}

	// Reassembled text should contain all original words
	rejoined := strings.Join(chunks, " ")
	originalWords := strings.Fields(text)
	rejoinedWords := strings.Fields(rejoined)
	if len(originalWords) != len(rejoinedWords) {
		t.Fatalf("word count mismatch: original %d, rejoined %d", len(originalWords), len(rejoinedWords))
	}
}

func TestChunkText_EmptyText(t *testing.T) {
	chunks := llm.ChunkText("", 500)
	if len(chunks) != 0 {
		t.Fatalf("expected 0 chunks for empty text, got %d", len(chunks))
	}
}

func TestMergeResults_PicksHighestSeverity(t *testing.T) {
	results := []llm.AnalysisResult{
		{Severity: "yellow", Summary: "Some issues", Flags: []llm.Flag{
			{Category: "Auto-Renewal", Severity: "yellow", Explanation: "Renews automatically."},
		}},
		{Severity: "red", Summary: "Serious issues", Flags: []llm.Flag{
			{Category: "Data Selling", Severity: "red", Explanation: "Sells your data."},
		}},
	}

	merged := llm.MergeResults(results)

	if merged.Severity != "red" {
		t.Fatalf("expected severity red, got %s", merged.Severity)
	}
	if len(merged.Flags) != 2 {
		t.Fatalf("expected 2 flags, got %d", len(merged.Flags))
	}
}

func TestMergeResults_DeduplicatesCategory(t *testing.T) {
	results := []llm.AnalysisResult{
		{Severity: "red", Summary: "Issues", Flags: []llm.Flag{
			{Category: "Data Selling", Severity: "red", Explanation: "First mention."},
		}},
		{Severity: "red", Summary: "More issues", Flags: []llm.Flag{
			{Category: "Data Selling", Severity: "red", Explanation: "Second mention."},
		}},
	}

	merged := llm.MergeResults(results)

	if len(merged.Flags) != 1 {
		t.Fatalf("expected 1 deduplicated flag, got %d", len(merged.Flags))
	}
}

func TestMergeResults_AllGreen(t *testing.T) {
	results := []llm.AnalysisResult{
		{Severity: "green", Summary: "Looks fine.", Flags: []llm.Flag{}},
		{Severity: "green", Summary: "Also fine.", Flags: []llm.Flag{}},
	}

	merged := llm.MergeResults(results)

	if merged.Severity != "green" {
		t.Fatalf("expected green, got %s", merged.Severity)
	}
	if len(merged.Flags) != 0 {
		t.Fatalf("expected 0 flags, got %d", len(merged.Flags))
	}
}

func TestMergeResults_EmptyInput(t *testing.T) {
	merged := llm.MergeResults([]llm.AnalysisResult{})

	if merged.Severity != "green" {
		t.Fatalf("expected green for empty input, got %s", merged.Severity)
	}
}

func TestSeverityRank(t *testing.T) {
	cases := []struct {
		sev  string
		rank int
	}{
		{"red", 2},
		{"yellow", 1},
		{"green", 0},
	}
	for _, tc := range cases {
		got := llm.SeverityRank(tc.sev)
		if got != tc.rank {
			t.Errorf("SeverityRank(%q) = %d, want %d", tc.sev, got, tc.rank)
		}
	}
}
