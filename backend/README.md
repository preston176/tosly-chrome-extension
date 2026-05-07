# Tosly backend

Stateless Go service that takes ToS text and returns a structured analysis.

## Run locally

```bash
cp .env.example .env  # add your LLM API key
go run .
# → listening on :8080
```

## Endpoints

### `GET /health`

```bash
curl http://localhost:8080/health
# ok
```

### `POST /analyze`

**Request:**

```json
{
  "url": "https://example.com/privacy",
  "text": "By using this service you agree to..."
}
```

Both `url` and `text` are required. Returns `400` if either is missing or empty.

**Response:**

```json
{
  "severity": "red",
  "summary": "This service collects your personal information and shares it with advertisers.",
  "flags": [
    {
      "category": "Data Selling",
      "severity": "red",
      "explanation": "Your personal information is sold to other companies for ads.",
      "quote": "We may share your data with third parties for advertising purposes."
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `severity` | `"red" \| "yellow" \| "green"` | Worst-case across all flags |
| `summary` | `string` | One-sentence plain-English summary |
| `flags[].category` | `string` | e.g. `"Data Selling"`, `"Auto-Renewal"`, `"Arbitration"` |
| `flags[].severity` | `"red" \| "yellow" \| "green"` | Per-flag severity |
| `flags[].explanation` | `string` | Why this clause matters, in plain English |
| `flags[].quote` | `string` | Verbatim text from the document |

## Caching

Results are cached in-memory per URL for 7 days. The same URL is never re-analyzed during that window. The cache holds analysis output only — no user identifiers.

Restarting the service clears the cache.

## Layout

```
backend/
├── main.go            # HTTP server, CORS, routing
├── handlers/          # /analyze handler, request validation
├── llm/               # LLM client + prompt
└── cache/             # in-memory LRU with TTL
```

The prompt is the file most worth reading if you're curious how the analysis stays consistent.

## Tests

```bash
go test ./...
```

## Docker

```bash
docker compose up --build
```

`docker-compose.yml` reads `GEMINI_API_KEY` from the host environment.
