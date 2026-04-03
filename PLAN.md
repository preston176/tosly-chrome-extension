# Tosly — Build Plan

> "Grammarly for Legal Risk" — an AI-native browser extension that protects consumers from predatory terms of service in real-time.

---

## What We're Building

Tosly intercepts the moment a user is about to accept a Terms of Service or Privacy Policy, scans the document using an LLM, and surfaces the scariest clauses in plain English via a non-intrusive "Traffic Light" popup.

**Three steps:**
1. **Intercept** — Detect TOS/privacy pages and checkout flows
2. **Translate** — Go backend sends text to Gemini, extracts red flags
3. **Alert** — Traffic light popup appears before the user clicks "Accept"

---

## Monorepo Structure

```
tosly-chrome-extension/
├── PLAN.md                  ← this file
├── extension/               ← Plasmo (React) Chrome extension
│   ├── background.ts        ← service worker, API calls, cache
│   ├── content.ts           ← page detection logic
│   ├── contents/
│   │   ├── shield-ui.tsx    ← floating shield icon (CSUI)
│   │   └── result-panel.tsx ← traffic light result panel (CSUI)
│   ├── popup.tsx            ← extension popup / onboarding
│   ├── package.json
│   └── ...
├── backend/                 ← Go REST API
│   ├── main.go
│   ├── handlers/
│   │   └── analyze.go       ← POST /analyze
│   ├── llm/
│   │   └── gemini.go        ← Gemini API client + prompt
│   ├── cache/
│   │   └── cache.go         ← in-memory domain cache
│   └── go.mod
└── landing/                 ← Next.js one-pager (Vercel) [Phase 3]
```

---

## API Contract

### `POST /analyze`

**Request:**
```json
{
  "url": "https://spotify.com/privacy",
  "text": "...full page text..."
}
```

**Response:**
```json
{
  "severity": "red",
  "summary": "This policy has 3 serious issues you should know about.",
  "flags": [
    {
      "category": "Data Selling",
      "severity": "red",
      "explanation": "They can share your listening history with advertisers."
    },
    {
      "category": "Forced Arbitration",
      "severity": "red",
      "explanation": "You give up your right to sue in court."
    },
    {
      "category": "Auto-Renewal",
      "severity": "yellow",
      "explanation": "Your subscription renews automatically with no reminder email."
    }
  ]
}
```

**Severity rules:**
- `red` — any flag is red → overall red
- `yellow` — only yellow flags → overall yellow
- `green` — no significant issues found

---

## Flag Categories (LLM Scans For These)

| Category | Example Clause |
|---|---|
| Data Selling | "We may share your data with third-party advertisers" |
| Hidden Fees | "Additional charges may apply without notice" |
| Forced Arbitration | "You waive your right to a jury trial" |
| Auto-Renewal | "Subscription renews unless cancelled 30 days prior" |
| Data Deletion Rights | "We retain your data for up to 7 years after account closure" |
| Third-Party Sharing | "We share data with our corporate partners" |

---

## Backend — Go

### Stack
- `net/http` — standard library HTTP server
- `google/generative-ai-go` — official Gemini Go SDK
- In-memory cache keyed by domain (expires 7 days)
- Goroutine-based text chunking for long documents (> ~8k words)

### Chunking Strategy
Long TOS docs will exceed LLM context. Plan:
1. Split `text` into ~3000-word chunks by paragraph boundaries
2. Fire goroutines for each chunk, each with the same prompt
3. Merge results: take the highest severity flags, deduplicate by category

### Gemini Prompt
```
System:
You are a consumer protection legal analyst. Your job is to protect everyday people from predatory legal language. Explain everything as if the reader is 16 years old — no legal jargon.

User:
Analyze the following Terms of Service or Privacy Policy text. 

Look specifically for issues in these 6 categories:
1. Data Selling — selling or sharing user data with third parties for profit
2. Hidden Fees — charges not prominently disclosed
3. Forced Arbitration — clauses that prevent users from suing in court
4. Auto-Renewal — subscriptions that renew without clear reminder
5. Data Deletion Rights — how long data is kept after account closure
6. Third-Party Sharing — data shared with partners or affiliates

Return ONLY valid JSON in this exact format:
{
  "severity": "red|yellow|green",
  "summary": "one sentence plain-English summary",
  "flags": [
    {
      "category": "...",
      "severity": "red|yellow|green",
      "explanation": "one sentence, plain English, max 20 words"
    }
  ]
}

If no issues are found, return severity "green" and an empty flags array.

TEXT TO ANALYZE:
[text]
```

### Deployment
- Local for MVP (`localhost:8080`)
- VPS (e.g., Hetzner/DigitalOcean) for production — single Go binary, systemd service, Caddy reverse proxy

---

## Extension — Plasmo + React

### Tech
- [Plasmo](https://docs.plasmo.com/) — extension framework
- React + TypeScript
- Tailwind CSS (scoped via Plasmo's Shadow DOM)
- `@plasmohq/storage` — persistent cache
- `@plasmohq/messaging` — content ↔ background communication

### Detection Logic (`content.ts`)

**Auto-scan trigger (high confidence TOS page):**
- URL path contains: `/privacy`, `/terms`, `/legal`, `/tos`, `/conditions`, `/eula`
- Page `<title>` contains "privacy policy" or "terms of service"

**Manual trigger (checkout/signup page):**
- Page contains a checkbox near text matching "agree", "accept", "I have read"
- Show the shield icon; user clicks to trigger scan

### UI Components

#### Floating Shield Icon (`contents/shield-ui.tsx`)
- Position: bottom-right, fixed, above page content
- States: idle (grey shield), scanning (spinner), red/yellow/green (colored shield)
- Click → opens Result Panel

#### Result Panel (`contents/result-panel.tsx`)
```
┌─────────────────────────────────┐
│  🔴 HIGH RISK          [tosly]  │
├─────────────────────────────────┤
│  This policy has 3 serious      │
│  issues you should know about.  │
├─────────────────────────────────┤
│  ⚠ Data Selling                 │
│  They share your data with      │
│  third-party advertisers.       │
│                                 │
│  ⚠ Forced Arbitration           │
│  You give up your right to sue. │
│                                 │
│  ⚡ Auto-Renewal                 │
│  Renews with no reminder email. │
├─────────────────────────────────┤
│  [Full Report ↗]    [Got it ✓] │
└─────────────────────────────────┘
```

#### Extension Popup (`popup.tsx`)
- 3-bullet onboarding: what Tosly does
- Toggle: auto-scan on/off
- Link to landing page / feedback

### Caching
- Key: domain (e.g., `spotify.com`)
- Value: full API response JSON
- TTL: 7 days (stored via `@plasmohq/storage`)
- On cache hit: show result instantly, no API call

### Message Flow
```
content.ts
  → sends message to background.ts ("analyze", { url, text })

background.ts
  → checks @plasmohq/storage for cached result
  → if miss: POST /analyze to Go backend
  → stores result in cache
  → sends result back to content.ts

contents/shield-ui.tsx + result-panel.tsx
  → renders result
```

---

## Build Order

### Saturday AM — Go Backend (4h)
- [ ] `go mod init github.com/tosly/backend`
- [ ] `main.go` — HTTP server, CORS headers, `/analyze` route
- [ ] `handlers/analyze.go` — parse request, call LLM, return JSON
- [ ] `llm/gemini.go` — Gemini SDK client, prompt template, chunking
- [ ] `cache/cache.go` — in-memory domain cache with TTL
- [ ] Test with `curl` against Spotify/Facebook TOS text

### Saturday PM — Extension Skeleton (4h)
- [ ] `cd extension && npx plasmo init`
- [ ] Install deps: `@plasmohq/storage`, `@plasmohq/messaging`, Tailwind
- [ ] `content.ts` — URL/title detection, grab `document.body.innerText`
- [ ] `background.ts` — message handler, cache check, API call
- [ ] `contents/shield-ui.tsx` — floating shield CSUI, idle state only

### Sunday AM — UI Polish (4h)
- [ ] `contents/result-panel.tsx` — full traffic light panel
- [ ] Wire up: content → background → shield → panel
- [ ] `popup.tsx` — onboarding + auto-scan toggle
- [ ] End-to-end test: Facebook privacy, Spotify TOS, Netflix TOS

### Sunday PM — Pitch Assets (3h)
- [ ] `landing/` — Next.js one-pager, Vercel deploy
- [ ] Demo recording (screen capture showing red flag on real site)
- [ ] `plasmo build` → Chrome Web Store submission or GitHub beta zip

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| LLM | Gemini (google/generative-ai-go) | Already have access; good context window for long TOS docs |
| Extension framework | Plasmo | Shadow DOM isolation, CSUI, hot reload, TS-first |
| Backend | Go stdlib `net/http` | No deps, fast, easy to deploy as single binary |
| Cache (extension) | `@plasmohq/storage` | Persists across sessions, simple API |
| Cache (backend) | In-memory map + sync.RWMutex | Sufficient for MVP, no infra needed |
| Styling | Tailwind (scoped) | Fast iteration, Plasmo handles isolation |
| Deployment | VPS + Caddy (later) | Single binary, cheap, full control |

---

## "Aha!" Moment Strategy

For the demo, land on **Facebook's Data Policy** (`facebook.com/privacy/policy`). It will reliably produce:
- Red: Data shared with advertisers
- Red: Data retained after account deletion
- Yellow: Third-party integrations

This is the opening shot of the demo video and the hero use case on the landing page.

---

## Phase 2 (Post-MVP)

- **Freemium**: Traffic light free; "Full Report" + subscription cancellation automation = $5/month
- **B2B API**: License `/analyze` to fintech apps and insurance companies
- **Consent-Tech category**: Position Tosly as the first "Consent-Tech" product

---

## Open Questions / Decisions Made

| Question | Answer |
|---|---|
| LLM provider | Gemini |
| Monorepo or separate? | Monorepo |
| Backend hosting | localhost for MVP, VPS later |
| Product name | Tosly |
