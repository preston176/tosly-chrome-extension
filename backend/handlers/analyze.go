package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/tosly/backend/cache"
	"github.com/tosly/backend/llm"
)

// AnalyzeRequest is the expected JSON body for POST /analyze.
type AnalyzeRequest struct {
	URL  string `json:"url"`
	Text string `json:"text"`
}

// Cacher is the subset of cache.Cache the handler needs.
type Cacher interface {
	Get(key string) ([]byte, bool)
	Set(key string, value []byte)
}

// AnalyzeHandler handles POST /analyze.
type AnalyzeHandler struct {
	analyzer llm.Analyzer
	cache    Cacher
}

func NewAnalyzeHandler(analyzer llm.Analyzer, c *cache.Cache) *AnalyzeHandler {
	return &AnalyzeHandler{analyzer: analyzer, cache: c}
}

func (h *AnalyzeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.URL == "" || req.Text == "" {
		http.Error(w, "url and text are required", http.StatusBadRequest)
		return
	}

	domain := extractDomain(req.URL)

	// Cache hit — return immediately
	if cached, ok := h.cache.Get(domain); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Write(cached)
		return
	}

	result, err := h.analyzer.Analyze(req.Text)
	if err != nil {
		http.Error(w, "analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	b, err := json.Marshal(result)
	if err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
		return
	}

	h.cache.Set(domain, b)

	w.Header().Set("Content-Type", "application/json")
	w.Write(b)
}

// extractDomain returns just the host from a URL, falling back to the raw URL on parse error.
func extractDomain(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil || u.Host == "" {
		return rawURL
	}
	return u.Host
}
