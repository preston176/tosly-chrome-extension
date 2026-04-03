package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/tosly/backend/cache"
	"github.com/tosly/backend/handlers"
	"github.com/tosly/backend/llm"
)

func main() {
	// Load .env if present; silently ignore if it doesn't exist (prod uses real env vars)
	_ = godotenv.Load()

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Fatal("GEMINI_API_KEY environment variable is required")
	}

	analyzer, err := llm.NewGeminiClient(apiKey)
	if err != nil {
		log.Fatalf("failed to create Gemini client: %v", err)
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
