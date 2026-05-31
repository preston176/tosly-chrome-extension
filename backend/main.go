package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/tosly/backend/cache"
	"github.com/tosly/backend/handlers"
	"github.com/tosly/backend/llm"
)

func main() {
	// Load .env if present; silently ignore if it doesn't exist (prod uses real env vars)
	_ = godotenv.Load()

	analyzer, err := buildAnalyzer()
	if err != nil {
		log.Fatal(err)
	}

	c := cache.New(7 * 24 * time.Hour)
	analyzeHandler := handlers.NewAnalyzeHandler(analyzer, c)

	mux := http.NewServeMux()
	mux.Handle("/analyze", withCORS(analyzeHandler))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	addr := ":8080"
	log.Printf("tosly backend listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// buildAnalyzer assembles the LLM fallback chain from whichever provider keys
// are set. Gemini is tried first (when configured); Groq is the free fallback.
// At least one provider must be configured.
func buildAnalyzer() (llm.Analyzer, error) {
	var providers []llm.NamedAnalyzer

	if key := os.Getenv("GEMINI_API_KEY"); key != "" {
		gemini, err := llm.NewGeminiClient(key)
		if err != nil {
			return nil, fmt.Errorf("creating gemini client: %w", err)
		}
		providers = append(providers, llm.NamedAnalyzer{Name: "gemini", Analyzer: gemini})
	}

	if key := os.Getenv("GROQ_API_KEY"); key != "" {
		providers = append(providers, llm.NamedAnalyzer{
			Name:     "groq",
			Analyzer: llm.NewGroqClient(key, os.Getenv("GROQ_MODEL")),
		})
	}

	if len(providers) == 0 {
		return nil, fmt.Errorf("no LLM provider configured: set GEMINI_API_KEY and/or GROQ_API_KEY")
	}

	names := make([]string, len(providers))
	for i, p := range providers {
		names[i] = p.Name
	}
	log.Printf("LLM providers (fallback order): %s", strings.Join(names, ", "))

	return llm.NewChain(providers...), nil
}

// withCORS wraps a handler to allow requests from the Chrome extension.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
