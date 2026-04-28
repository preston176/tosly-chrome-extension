# Tosly

> AI that reads the Terms of Service so you don't have to.

Tosly is a Chrome extension that scans Terms of Service and Privacy Policy pages, surfaces predatory clauses in plain English, and highlights the exact text from the document - all before you click "I Agree".

- **Try it:** [Chrome Web Store](https://chromewebstore.google.com/) *(link coming soon)*
- **Landing page:** [tosly.app](https://tosly.app) *(link coming soon)*

---

## How it works

```
┌──────────────────┐    HTTPS POST    ┌───────────────────┐
│ Chrome extension │ ───────────────▶ │   Go backend      │
│  (Plasmo / TS)   │                  │   /analyze        │
│                  │ ◀─────────────── │                   │
└──────────────────┘   structured     └────────┬──────────┘
                       JSON response           │
                                               │ LLM API
                                               ▼
                                        ┌────────────┐
                                        │  AI model  │
                                        └────────────┘
```

1. **Content script** detects ToS/Privacy pages and extracts visible text
2. **Backend** prompts an LLM with a structured-output schema and returns:
   - severity (`red` / `yellow` / `green`)
   - plain-English summary
   - array of flags, each with category, explanation, and the exact quote from the document
3. **Extension popup** renders the result with traffic-light tiers and clickable highlights

Results are cached for 7 days per URL on the backend to keep latency and LLM costs down.

---

## Repo layout

This is a monorepo with three packages:

| Package | Stack | What it does |
|---------|-------|--------------|
| [`extension/`](extension/) | Plasmo, React, TypeScript, Tailwind | The Chrome extension (Manifest V3) |
| [`backend/`](backend/) | Go 1.24 | Stateless analysis API with in-memory LRU cache |
| [`landing/`](landing/) | Astro, Tailwind | Marketing site at tosly.app |

---

## Getting started

### Prerequisites

- Node 20+
- Go 1.24+
- An LLM API key (see `backend/.env.example`)

### Run the backend

```bash
cd backend
cp .env.example .env  # then fill in your API key
go run .
# → listening on :8080
```

Health check:

```bash
curl http://localhost:8080/health
# ok
```

### Run the extension

```bash
cd extension
npm install --legacy-peer-deps
npm run dev
```

Then load `extension/build/chrome-mv3-dev` as an unpacked extension in `chrome://extensions`.

The dev build talks to `http://localhost:8080`. The production build is configured via CI (`PLASMO_PUBLIC_BACKEND_URL`).

### Run the landing page

```bash
cd landing
npm install --legacy-peer-deps
npm run dev
# → http://localhost:4321
```

---

## API contract

`POST /analyze`

```json
{
  "url": "https://spotify.com/legal/privacy-policy",
  "text": "By using this service you agree to..."
}
```

Response:

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

---

## Deployment

| What | Where | Triggered by |
|------|-------|--------------|
| Backend | Container host | Push to `main` (auto-deploys via host's GitHub integration) |
| Extension | Chrome Web Store + GitHub Releases | Push tag `extension-v*` (see [`extension/RELEASE.md`](extension/RELEASE.md)) |
| Landing | TBD (Vercel / Netlify) | - |

CI workflows live in [`.github/workflows/`](.github/workflows/):

- `extension-build.yml` - builds + packages extension on every push to `main`
- `extension-release.yml` - cuts a GitHub Release on `extension-v*` tags, optionally publishes to Chrome Web Store

---

## Tech notes

**Why Go for the backend?**
Stateless analysis fits a single binary perfectly. The LLM client uses structured-output mode for reliable JSON, which removes the brittleness of parsing free-form text.

**Why Plasmo for the extension?**
Hot reload, scoped CSS (no host-page bleed), and built-in MV3 support. Cuts the boilerplate every extension project re-writes.

**LLM provider**
The prompt is designed to be model-agnostic - swapping providers is a single file change in `backend/llm/`.

---

## Roadmap

- [ ] Local-only mode (small on-device model for offline analysis)
- [ ] Browser sync of flagged history
- [ ] Firefox / Safari ports
- [ ] Public API for other extensions / sites
- [ ] Diff mode: detect when a ToS changes and re-analyze

---

## Disclaimer

Tosly provides useful signal for personal decisions. **It is not legal advice.** For important contracts, consult a qualified attorney.

---

## License

TBD.
