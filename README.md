<div align="center">
  <img src="extension/assets/logo.png" alt="Tosly" height="80" />

  **Tosly reads Terms of Service pages with an LLM and flags the clauses that work against you - data selling, forced arbitration, surveillance, auto-renewals - with the exact quote from the document.**

  [Chrome Web Store](#) · [Firefox - planned](#) · [Landing page](#) · [Report a bug](https://github.com/preston176/tosly-chrome-extension/issues/new)

</div>

---

## Example

Open Spotify's privacy policy. Tosly highlights this:

> *"We may share your personal data with third-party advertising partners at our discretion."*

And tells you, in plain English:

```
Severity: HIGH RISK
Category: Data Selling
Why it matters: Your personal information is sold to other
companies for ads. You cannot opt out by using the service.
```

Same for forced arbitration clauses, auto-renewals, broad license grants, and ~40 other patterns.

---

## Install

| Browser | Status |
|---------|--------|
| Chrome / Edge / Brave | [Chrome Web Store](#) |
| Firefox | Planned |
| Safari | Not planned |

---

## Privacy & Permissions

Tosly is a privacy tool. It would be embarrassing to leak your data, so:

- **What leaves your browser:** the visible text of the ToS page you're on, plus its URL. That's it.
- **What does NOT leave:** your identity, browsing history, cookies, form data, or any other page content.
- **No account.** No login. No fingerprint.
- **Cache:** results are cached server-side per URL for 7 days. The same page is never re-analyzed for any user during that window. The cache holds analysis output, not user identifiers.

### Manifest permissions

| Permission | Why |
|------------|-----|
| `storage` | Saves your widget position and "auto-scan on/off" preference locally |
| `tabs` | Detects when you navigate to a ToS or Privacy Policy page |
| `host_permissions: <all_urls>` | Required to read ToS text on whatever site you visit |

The full request payload is in [`backend/handlers/analyze.go`](backend/handlers/analyze.go). The full prompt sent to the LLM is in [`backend/llm/`](backend/llm/). Read the source.

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

1. Content script detects ToS / Privacy pages and extracts visible text.
2. Backend prompts an LLM with a structured-output schema.
3. Extension renders the result: severity (red / yellow / green), summary, and per-flag quotes highlighted on the page.

The prompt is the actual product. It lives in `backend/llm/` and is the file most worth reading if you're curious how the analysis stays consistent.

---

## Repo layout

```
tosly/
├── extension/   # Chrome MV3 extension (Plasmo, React, TypeScript)
├── backend/     # Go LLM-analysis API
└── landing/     # Astro marketing site
```

| Package | Stack | What it does |
|---------|-------|--------------|
| [`extension/`](extension/) | Plasmo, React, TypeScript, Tailwind | The Chrome extension (Manifest V3) |
| [`backend/`](backend/) | Go 1.24 | Stateless analysis API with in-memory LRU cache |
| [`landing/`](landing/) | Astro, Tailwind | Marketing site |

---

## Local development

### Prerequisites
- Node 20+
- Go 1.24+
- An LLM API key (see [`backend/.env.example`](backend/.env.example))

### Backend

```bash
cd backend
cp .env.example .env  # add your API key
go run .
# → listening on :8080
```

### Extension

```bash
cd extension
npm install --legacy-peer-deps
npm run dev
```

Then load `extension/build/chrome-mv3-dev` as an unpacked extension at `chrome://extensions`. The dev build talks to `http://localhost:8080`. Production is configured via `PLASMO_PUBLIC_BACKEND_URL` at build time.

### Landing page

```bash
cd landing
npm install --legacy-peer-deps
npm run dev
# → http://localhost:4321
```

---

## API

`POST /analyze`

```json
{
  "url": "https://example.com/privacy",
  "text": "By using this service you agree to..."
}
```

Returns:

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

## Releasing

| Surface | Trigger |
|---------|---------|
| Backend | Push to `main` (auto-deploys via host's GitHub integration) |
| Extension | Push tag `extension-v*` (see [`extension/RELEASE.md`](extension/RELEASE.md)) |
| Landing | Push to `main` |

CI workflows live in [`.github/workflows/`](.github/workflows/).

---

## Contributing

Issues and PRs welcome. Two things to know before opening one:

1. **Bug reports need the URL.** Tosly's behavior depends entirely on the ToS text it sees. Without the page URL or the text, a bug report is unactionable.
2. **High bar for new clause categories.** Each detected category gets prompt-engineered, validated against real ToS samples, and pinned. Drive-by additions get rejected. Open an issue first if you have one in mind.

---

## What's next

- Local-only mode: a small on-device model for fully offline analysis
- Firefox port
- Diff mode: detect when a known ToS changes and re-flag

These are concrete; everything else is "maybe."

---

## Disclaimer

Tosly provides useful signal for personal decisions. **It is not legal advice.** For important contracts, consult a qualified attorney.

---

## License

TBD.
