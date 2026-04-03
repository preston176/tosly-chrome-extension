# Tosly — Plasmo Extension Plan

## Stack
- **Plasmo** — extension framework (Shadow DOM, CSUI, hot reload)
- **React + TypeScript**
- **Tailwind CSS** (scoped, no host page bleed)
- **@plasmohq/storage** — persistent cache across sessions
- **@plasmohq/messaging** — content ↔ background communication

---

## Directory Structure

```
extension/
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── .env                        ← PLASMO_PUBLIC_BACKEND_URL=http://localhost:8080
│
├── background.ts               ← service worker: messaging hub, API calls, cache
│
├── content.ts                  ← page detection, text extraction, triggers scan
│
├── contents/
│   ├── shield-ui.tsx           ← CSUI: floating shield icon (always injected)
│   └── result-panel.tsx        ← CSUI: traffic light result panel (shown on result)
│
└── popup.tsx                   ← extension popup: onboarding + toggle
```

---

## Data Flow

```
content.ts
  detects TOS page or checkout
  grabs document.body.innerText
  sends msg → background: { type: "ANALYZE", url, text }

background.ts
  checks @plasmohq/storage for domain cache
  cache HIT  → sends result back immediately
  cache MISS → POST /analyze to Go backend
             → stores result in storage (7-day TTL)
             → sends result back

contents/shield-ui.tsx
  always mounted (bottom-right corner)
  listens for result from background
  states: idle | scanning | red | yellow | green
  click → opens result-panel

contents/result-panel.tsx
  renders traffic light UI with flags
  "Got it" → dismisses
  "Full Report" → (Phase 2 placeholder)
```

---

## File-by-File Spec

### `content.ts`
**Detection — auto scan (high confidence TOS page):**
- URL path contains: `/privacy`, `/terms`, `/legal`, `/tos`, `/conditions`, `/eula`
- OR `document.title` contains "privacy policy" or "terms of service" (case-insensitive)

**Detection — manual trigger (checkout/signup):**
- Page has `<input type="checkbox">` near text matching "agree" / "accept" / "i have read"
- Show shield in "idle" state; user clicks to trigger

**On trigger:**
- Grab `document.body.innerText` (trimmed, max 50k chars to cap payload)
- Send `ANALYZE` message to background
- Send `SCANNING` message to shield UI

---

### `background.ts`
- Listen for `ANALYZE` messages from content scripts
- Extract domain from URL (`new URL(url).hostname`)
- Check `@plasmohq/storage` for cached result
- On miss: `fetch(BACKEND_URL/analyze, { method: POST, body: { url, text } })`
- Store result: `storage.set(domain, { result, cachedAt: Date.now() })`
- TTL check on read: if `Date.now() - cachedAt > 7days` → treat as miss
- Broadcast result back via messaging

---

### `contents/shield-ui.tsx` (CSUI)
**Position:** fixed, bottom-right, `z-index: 2147483647`

**States:**
| State | Visual |
|---|---|
| `idle` | Grey shield icon |
| `scanning` | Shield + spinner animation |
| `red` | Red shield + pulse animation |
| `yellow` | Yellow shield |
| `green` | Green shield |

**Behavior:**
- Click → toggles result panel open/closed
- Auto-opens panel when result arrives (red/yellow only)

---

### `contents/result-panel.tsx` (CSUI)
**Layout:**
```
┌─────────────────────────────────┐
│  🔴 HIGH RISK          [tosly]  │
├─────────────────────────────────┤
│  Summary sentence here.         │
├─────────────────────────────────┤
│  ● Data Selling          [RED]  │
│  They share your data with      │
│  third-party advertisers.       │
│                                 │
│  ● Forced Arbitration    [RED]  │
│  You give up your right to sue. │
│                                 │
│  ● Auto-Renewal        [YELLOW] │
│  Renews with no reminder email. │
├─────────────────────────────────┤
│  [Full Report ↗]   [Got it ✓]  │
└─────────────────────────────────┘
```

**Props:** receives `AnalysisResult` from shield state, `onDismiss` callback

---

### `popup.tsx`
- Tosly logo + tagline
- 3-bullet onboarding:
  1. Tosly detects Terms of Service pages automatically
  2. Our AI scans for hidden risks in seconds
  3. You see a plain-English warning before you click Accept
- Toggle: auto-scan on/off (stored in `@plasmohq/storage`)
- Link: "Report a false positive" (mailto or GitHub issues)

---

## Shared Types (`types.ts`)

```ts
export type Severity = "red" | "yellow" | "green"

export interface Flag {
  category: string
  severity: Severity
  explanation: string
}

export interface AnalysisResult {
  severity: Severity
  summary: string
  flags: Flag[]
}

export type ShieldState = "idle" | "scanning" | Severity
```

---

## Messaging Contract

### content → background
```ts
// Trigger analysis
{ type: "ANALYZE", payload: { url: string, text: string } }
```

### background → content (shield)
```ts
// Analysis complete
{ type: "RESULT", payload: AnalysisResult }

// Pass-through scanning state
{ type: "SCANNING" }
```

---

## Environment

```
# extension/.env
PLASMO_PUBLIC_BACKEND_URL=http://localhost:8080
```

Plasmo exposes `process.env.PLASMO_PUBLIC_BACKEND_URL` in all extension contexts.

---

## Build Order (TDD where testable)

### Step 1 — Scaffold & types
- `npx plasmo init` inside `extension/`
- Install deps: `@plasmohq/storage`, `@plasmohq/messaging`, Tailwind
- Create `types.ts`
- Create `.env`

### Step 2 — Background service worker
- Implement cache read/write with TTL
- Implement `fetch` call to backend
- Wire messaging handlers
- **Test:** `background.test.ts` — mock fetch, assert cache hit skips fetch, assert result broadcast

### Step 3 — Content detection script
- Implement URL + title detection
- Implement text extraction (capped at 50k chars)
- Trigger message to background
- **Test:** `content.test.ts` — jsdom, assert detection logic, assert message sent

### Step 4 — Shield UI
- Build CSUI component
- Handle state transitions
- No unit test (visual); manual test in browser

### Step 5 — Result panel
- Build traffic light panel component
- Wire to shield state
- Manual test in browser

### Step 6 — Popup
- Onboarding UI
- Auto-scan toggle

### Step 7 — End-to-end
- `plasmo dev` + load unpacked in Chrome
- Test on: Facebook privacy, Spotify TOS, Netflix TOS
- Verify cache: revisit same page → instant result

---

## Notes
- Plasmo CSUI handles Shadow DOM automatically — no CSS bleed from host page
- Use `cssText` injection or Tailwind's `important` strategy if needed for specificity
- Keep shield and panel as two separate CSUI files — easier to control z-index and mount lifecycle independently
- The `background.ts` owns all network calls — content scripts never call the backend directly (avoids CORS complexity in content script context)
