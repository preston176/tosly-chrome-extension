import { Storage } from "@plasmohq/storage"
import type { AnalysisResult, Severity } from "~types"

const storage = new Storage()
const MAX_TEXT_LENGTH = 50_000
const HIGHLIGHT_ATTR = "data-tosly-highlight"

const TOS_PATH_PATTERNS = [
  /\/privacy/i,
  /\/terms/i,
  /\/legal/i,
  /\/tos/i,
  /\/conditions/i,
  /\/eula/i,
  /\/user-agreement/i,
  /\/cookie-policy/i
]

const TOS_TITLE_PATTERNS = [
  /privacy policy/i,
  /terms of service/i,
  /terms and conditions/i,
  /terms of use/i,
  /user agreement/i
]

const CONSENT_CHECKBOX_PATTERNS = [/agree/i, /accept/i, /i have read/i, /i understand/i]

const SEVERITY_HIGHLIGHT_STYLES: Record<Severity, { background: string; outline: string }> = {
  red: { background: "rgba(239,68,68,0.25)", outline: "rgba(239,68,68,0.7)" },
  yellow: { background: "rgba(234,179,8,0.2)", outline: "rgba(234,179,8,0.65)" },
  green: { background: "rgba(34,197,94,0.15)", outline: "rgba(34,197,94,0.55)" }
}

function isTosPage(): boolean {
  const path = window.location.pathname + window.location.search
  if (TOS_PATH_PATTERNS.some((re) => re.test(path))) return true
  if (TOS_TITLE_PATTERNS.some((re) => re.test(document.title))) return true
  return false
}

function hasConsentCheckbox(): boolean {
  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
  for (const cb of checkboxes) {
    const nearby =
      cb.closest("label")?.textContent ||
      cb.parentElement?.textContent ||
      cb.nextSibling?.textContent ||
      ""
    if (CONSENT_CHECKBOX_PATTERNS.some((re) => re.test(nearby))) return true
  }
  return false
}

function extractText(): string {
  const text = document.body.innerText || ""
  return text.trim().slice(0, MAX_TEXT_LENGTH)
}

function triggerScan() {
  const text = extractText()
  if (!text) return
  chrome.runtime.sendMessage({
    type: "ANALYZE",
    payload: { url: window.location.href, text }
  })
}

async function isAutoScanEnabled(): Promise<boolean> {
  const val = await storage.get<boolean>("autoScan")
  return val !== false
}

// ── Highlighting ──────────────────────────────────────────────────────────────

function normalizeWS(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

// Collect all visible text nodes, skipping script/style/existing marks
function getTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName.toLowerCase()
      if (["script", "style", "noscript", "textarea", "input"].includes(tag))
        return NodeFilter.FILTER_REJECT
      if (parent.hasAttribute(HIGHLIGHT_ATTR)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })
  const nodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) nodes.push(node as Text)
  return nodes
}

// Build a lenient regex from a quote: tolerates whitespace variation and
// treats punctuation as optional so minor OCR/encoding diffs don't kill it
function buildQuoteRegex(quote: string): RegExp | null {
  const normalized = normalizeWS(quote)
  if (normalized.length < 8) return null

  // Escape regex special chars, then make whitespace flexible
  // and make non-alphanumeric chars optional (handles — vs -, " vs ", etc.)
  const pattern = normalized
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // escape
    .replace(/\\s\+/g, "\\s+") // keep explicit whitespace patterns
    .replace(/ /g, "\\s+") // space → flexible whitespace

  try {
    return new RegExp(pattern, "i")
  } catch {
    // Fallback: just use the first 60 chars as a literal
    const short = normalized.slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")
    try {
      return new RegExp(short, "i")
    } catch {
      return null
    }
  }
}

function highlightQuote(quote: string, severity: Severity): boolean {
  const re = buildQuoteRegex(quote)
  if (!re) return false

  // Strategy: build a virtual concatenated string of all text nodes with
  // their offsets, find the match in that string, then surgically split
  // the owning text node(s).
  const textNodes = getTextNodes(document.body)
  if (textNodes.length === 0) return false

  // Build index: [{node, start, end}]
  type Span = { node: Text; start: number; end: number }
  const spans: Span[] = []
  let cursor = 0
  for (const node of textNodes) {
    const len = (node.nodeValue || "").length
    spans.push({ node, start: cursor, end: cursor + len })
    cursor += len
  }

  // Concatenated text (no separators — innerText uses \n but that's fine for matching)
  const fullText = textNodes.map((n) => n.nodeValue || "").join("")
  const match = re.exec(fullText)
  if (!match) return false

  const matchStart = match.index
  const matchEnd = matchStart + match[0].length

  // Find which single text node contains the entire match
  // (cross-node highlighting is complex; skip if split across nodes)
  const ownerSpan = spans.find((s) => s.start <= matchStart && s.end >= matchEnd)
  if (!ownerSpan) return false

  const node = ownerSpan.node
  const nodeValue = node.nodeValue || ""
  const localStart = matchStart - ownerSpan.start
  const localEnd = matchEnd - ownerSpan.start

  const style = SEVERITY_HIGHLIGHT_STYLES[severity]
  const before = document.createTextNode(nodeValue.slice(0, localStart))
  const mark = document.createElement("mark")
  mark.setAttribute(HIGHLIGHT_ATTR, severity)
  mark.textContent = nodeValue.slice(localStart, localEnd)
  mark.style.cssText = [
    `background: ${style.background}`,
    `outline: 1px solid ${style.outline}`,
    `border-radius: 3px`,
    `padding: 1px 2px`,
    `color: inherit`,
    `font-family: inherit`,
    `font-size: inherit`,
    `cursor: default`,
    `box-decoration-break: clone`,
    `-webkit-box-decoration-break: clone`
  ].join(";")
  const after = document.createTextNode(nodeValue.slice(localEnd))

  const parent = node.parentNode!
  parent.replaceChild(after, node)
  parent.insertBefore(mark, after)
  parent.insertBefore(before, mark)

  // Scroll first red/yellow mark into view
  if (severity !== "green") {
    mark.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return true
}

function applyHighlights(result: AnalysisResult) {
  console.log("[Tosly] Applying highlights for", result.flags.length, "flags")
  for (const flag of result.flags) {
    if (flag.quote) {
      const ok = highlightQuote(flag.quote, flag.severity)
      console.log(`[Tosly] Flag "${flag.category}" quote match:`, ok, "|", flag.quote?.slice(0, 60))
    }
  }
}

function clearHighlights() {
  const marks = Array.from(document.querySelectorAll(`mark[${HIGHLIGHT_ATTR}]`))
  for (const mark of marks) {
    const parent = mark.parentNode!
    parent.replaceChild(document.createTextNode(mark.textContent || ""), mark)
    parent.normalize()
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const autoScan = await isAutoScanEnabled()

  if (autoScan && isTosPage()) {
    setTimeout(triggerScan, 1500)
    return
  }

  if (hasConsentCheckbox()) {
    chrome.runtime.sendMessage({ type: "IDLE_WITH_CHECKBOX" })
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "MANUAL_SCAN") {
    triggerScan()
  } else if (message.type === "RESULT") {
    // Discard stale results from a previous page navigation
    if (message.url && message.url !== window.location.href) return
    const result: AnalysisResult = message.payload
    clearHighlights()
    setTimeout(() => applyHighlights(result), 300)
  } else if (message.type === "CLEAR_HIGHLIGHTS") {
    clearHighlights()
  } else if (message.type === "SCROLL_TO_HIGHLIGHT") {
    const marks = Array.from(document.querySelectorAll(`mark[${HIGHLIGHT_ATTR}]`))
    const index = typeof message.index === "number" ? message.index : 0
    const target = marks[index] ?? marks[0]
    if (target) {
      // Briefly flash the target mark so the user's eye is drawn to it
      const el = target as HTMLElement
      const prev = el.style.outline
      el.style.outline = "2px solid white"
      el.style.outlineOffset = "2px"
      target.scrollIntoView({ behavior: "smooth", block: "center" })
      setTimeout(() => { el.style.outline = prev; el.style.outlineOffset = "" }, 800)
    }
  }
})

init()

export {}
