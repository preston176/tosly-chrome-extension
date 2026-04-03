package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/tosly/backend/cache"
	"github.com/tosly/backend/handlers"
	"github.com/tosly/backend/llm"
)

// stubAnalyzer is a test double for llm.Analyzer that returns a fixed result.
type stubAnalyzer struct {
	result llm.AnalysisResult
	err    error
	calls  int
}

func (s *stubAnalyzer) Analyze(text string) (llm.AnalysisResult, error) {
	s.calls++
	return s.result, s.err
}

func newRequest(t *testing.T, body handlers.AnalyzeRequest) *http.Request {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/analyze", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestAnalyzeHandler_ReturnsResult(t *testing.T) {
	stub := &stubAnalyzer{
		result: llm.AnalysisResult{
			Severity: "red",
			Summary:  "They sell your data.",
			Flags: []llm.Flag{
				{Category: "Data Selling", Severity: "red", Explanation: "They share data with advertisers."},
			},
		},
	}
	c := cache.New(1 * time.Hour)
	h := handlers.NewAnalyzeHandler(stub, c)

	req := newRequest(t, handlers.AnalyzeRequest{URL: "https://spotify.com/privacy", Text: "some tos text"})
	rr := httptest.NewRecorder()

	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp llm.AnalysisResult
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.Severity != "red" {
		t.Errorf("expected severity red, got %s", resp.Severity)
	}
	if len(resp.Flags) != 1 {
		t.Errorf("expected 1 flag, got %d", len(resp.Flags))
	}
}

func TestAnalyzeHandler_CachesResult(t *testing.T) {
	stub := &stubAnalyzer{
		result: llm.AnalysisResult{Severity: "green", Summary: "All good.", Flags: []llm.Flag{}},
	}
	c := cache.New(1 * time.Hour)
	h := handlers.NewAnalyzeHandler(stub, c)

	req1 := newRequest(t, handlers.AnalyzeRequest{URL: "https://spotify.com/privacy", Text: "tos text"})
	httptest.NewRecorder() // discard
	h.ServeHTTP(httptest.NewRecorder(), req1)

	// Second request to same domain — should hit cache, not call analyzer again
	req2 := newRequest(t, handlers.AnalyzeRequest{URL: "https://spotify.com/terms", Text: "tos text"})
	rr2 := httptest.NewRecorder()
	h.ServeHTTP(rr2, req2)

	if stub.calls != 1 {
		t.Errorf("expected analyzer called once (cache hit on 2nd), got %d calls", stub.calls)
	}
	if rr2.Code != http.StatusOK {
		t.Fatalf("expected 200 on cache hit, got %d", rr2.Code)
	}
}

func TestAnalyzeHandler_BadMethod(t *testing.T) {
	stub := &stubAnalyzer{}
	c := cache.New(1 * time.Hour)
	h := handlers.NewAnalyzeHandler(stub, c)

	req := httptest.NewRequest(http.MethodGet, "/analyze", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", rr.Code)
	}
}

func TestAnalyzeHandler_MissingText(t *testing.T) {
	stub := &stubAnalyzer{}
	c := cache.New(1 * time.Hour)
	h := handlers.NewAnalyzeHandler(stub, c)

	req := newRequest(t, handlers.AnalyzeRequest{URL: "https://spotify.com/privacy", Text: ""})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestAnalyzeHandler_MissingURL(t *testing.T) {
	stub := &stubAnalyzer{}
	c := cache.New(1 * time.Hour)
	h := handlers.NewAnalyzeHandler(stub, c)

	req := newRequest(t, handlers.AnalyzeRequest{URL: "", Text: "some text"})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestAnalyzeHandler_InvalidJSON(t *testing.T) {
	stub := &stubAnalyzer{}
	c := cache.New(1 * time.Hour)
	h := handlers.NewAnalyzeHandler(stub, c)

	req := httptest.NewRequest(http.MethodPost, "/analyze", bytes.NewReader([]byte(`not json`)))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestAnalyzeHandler_SetsContentTypeJSON(t *testing.T) {
	stub := &stubAnalyzer{
		result: llm.AnalysisResult{Severity: "green", Summary: "Fine.", Flags: []llm.Flag{}},
	}
	c := cache.New(1 * time.Hour)
	h := handlers.NewAnalyzeHandler(stub, c)

	req := newRequest(t, handlers.AnalyzeRequest{URL: "https://example.com/tos", Text: "text"})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	ct := rr.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}
}
