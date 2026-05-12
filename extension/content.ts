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

// Aggressive normalize: lowercase, collapse all whitespace, strip non-letter/digit/space.
// Smart quotes, em-dashes, non-breaking spaces, etc. all get stripped.
// Result: ONLY a-z, 0-9, and single spaces.
function normalizeForMatching(s: string): string {
  return s
    .toLowerCase()
    .replace(/[   ]/g, " ") // non-breaking spaces → regular space
    .replace(/[^a-z0-9\s]/g, "") // strip everything that isn't alphanumeric or whitespace
    .replace(/\s+/g, " ")
    .trim()
}

function makeMarkElement(severity: Severity, text: string): HTMLElement {
  const style = SEVERITY_HIGHLIGHT_STYLES[severity]
  const mark = document.createElement("mark")
  mark.setAttribute(HIGHLIGHT_ATTR, severity)
  mark.textContent = text
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
  return mark
}

// Wrap a slice [localStart, localEnd) of a text node in a <mark>, returning the mark element.
function wrapTextNodeSlice(
  node: Text,
  localStart: number,
  localEnd: number,
  severity: Severity,
  flagIndex: number
): HTMLElement | null {
  const value = node.nodeValue || ""
  if (localStart < 0 || localEnd > value.length || localStart >= localEnd) return null

  const parent = node.parentNode
  if (!parent) return null

  const before = document.createTextNode(value.slice(0, localStart))
  const middle = makeMarkElement(severity, value.slice(localStart, localEnd))
  middle.setAttribute("data-tosly-flag", String(flagIndex))
  const after = document.createTextNode(value.slice(localEnd))

  parent.replaceChild(after, node)
  parent.insertBefore(middle, after)
  parent.insertBefore(before, middle)
  return middle
}

// Returns a parallel array: for each char in the original concatenated string,
// the index of the corresponding char in the normalized string (or -1 if stripped).
function buildNormalizedIndexMap(original: string): { normalized: string; origToNorm: number[] } {
  const origToNorm: number[] = new Array(original.length)
  let normalized = ""
  let lastWasSpace = false

  for (let i = 0; i < original.length; i++) {
    const ch = original[i]
    const code = ch.charCodeAt(0)
    // non-breaking spaces and whitespace
    const isWS = /\s/.test(ch) || code === 0x00a0 || code === 0x2009 || code === 0x200b
    const isAlnum = /[a-zA-Z0-9]/.test(ch)

    if (isAlnum) {
      origToNorm[i] = normalized.length
      normalized += ch.toLowerCase()
      lastWasSpace = false
    } else if (isWS) {
      if (lastWasSpace || normalized.length === 0) {
        origToNorm[i] = -1
      } else {
        origToNorm[i] = normalized.length
        normalized += " "
        lastWasSpace = true
      }
    } else {
      // punctuation, quotes, dashes — strip
      origToNorm[i] = -1
    }
  }
  return { normalized: normalized.trimEnd(), origToNorm }
}

function highlightQuote(quote: string, severity: Severity, flagIndex: number): boolean {
  const normalizedQuote = normalizeForMatching(quote)
  if (normalizedQuote.length < 8) return false

  const textNodes = getTextNodes(document.body)
  if (textNodes.length === 0) return false

  // Build the concatenated original text (single-space separator between nodes)
  // and track each node's range in the concatenated string.
  type Span = { node: Text; start: number; end: number }
  const SEP = " "
  const spans: Span[] = []
  let cursor = 0
  let original = ""
  for (let i = 0; i < textNodes.length; i++) {
    const v = textNodes[i].nodeValue || ""
    spans.push({ node: textNodes[i], start: cursor, end: cursor + v.length })
    original += v
    if (i < textNodes.length - 1) {
      original += SEP
      cursor += v.length + SEP.length
    } else {
      cursor += v.length
    }
  }

  // Normalize the full original text AND build an index map back to the original
  const { normalized, origToNorm } = buildNormalizedIndexMap(original)

  // Find the normalized quote in the normalized page text
  const normIdx = normalized.indexOf(normalizedQuote)
  if (normIdx === -1) {
    console.log(`[Tosly] no normalized match for quote:`, quote.slice(0, 80), "| normalized:", normalizedQuote.slice(0, 80))
    return false
  }
  const normEnd = normIdx + normalizedQuote.length

  // Map back: find first original-char position where origToNorm[i] === normIdx,
  // and last where origToNorm[i] === normEnd - 1.
  let originalStart = -1
  let originalEnd = -1
  for (let i = 0; i < origToNorm.length; i++) {
    if (origToNorm[i] === normIdx) {
      originalStart = i
      break
    }
  }
  for (let i = origToNorm.length - 1; i >= 0; i--) {
    if (origToNorm[i] === normEnd - 1) {
      originalEnd = i + 1
      break
    }
  }
  if (originalStart === -1 || originalEnd === -1 || originalStart >= originalEnd) {
    console.log(`[Tosly] couldn't map normalized match back to original`)
    return false
  }

  // Find overlapping spans (text nodes) and wrap their intersecting slices
  const overlapping = spans.filter((s) => s.start < originalEnd && s.end > originalStart)
  if (overlapping.length === 0) return false

  let firstMark: HTMLElement | null = null
  for (let i = overlapping.length - 1; i >= 0; i--) {
    const span = overlapping[i]
    const sliceStart = Math.max(0, originalStart - span.start)
    const sliceEnd = Math.min(span.end - span.start, originalEnd - span.start)
    const created = wrapTextNodeSlice(span.node, sliceStart, sliceEnd, severity, flagIndex)
    if (created && i === 0) firstMark = created
  }

  if (firstMark && severity !== "green") {
    firstMark.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return true
}

function applyHighlights(result: AnalysisResult) {
  console.log("[Tosly] Applying highlights for", result.flags.length, "flags")
  // Index aligns with the result panel's `highlightableFlags` array
  // (panel filters to flags with quotes, then numbers them 0..N).
  let highlightableIndex = 0
  for (const flag of result.flags) {
    if (flag.quote) {
      const ok = highlightQuote(flag.quote, flag.severity, highlightableIndex)
      console.log(`[Tosly] Flag "${flag.category}" (idx ${highlightableIndex}) quote match:`, ok, "|", flag.quote?.slice(0, 60))
      highlightableIndex++
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

// Listen for in-DOM events from the shield UI content script.
// CustomEvents on `document` reliably cross content-script isolated worlds since both share the DOM.
document.addEventListener("tosly:scroll-to-highlight", (event: Event) => {
  const detail = (event as CustomEvent).detail
  const index = typeof detail?.index === "number" ? detail.index : 0
  // Each flag's quote may be split across multiple <mark> elements (when the quote
  // spans text-node boundaries). The first piece is the scroll target; we light up all.
  const pieces = Array.from(
    document.querySelectorAll<HTMLElement>(`mark[data-tosly-flag="${index}"]`)
  )
  const target = pieces[0]
  console.log("[Tosly] scroll-to-highlight", { index, pieces: pieces.length })
  if (target) {
    const prevStyles = pieces.map((p) => p.style.outline)
    pieces.forEach((p) => {
      p.style.outline = "2px solid white"
      p.style.outlineOffset = "2px"
    })
    target.scrollIntoView({ behavior: "smooth", block: "center" })
    setTimeout(() => {
      pieces.forEach((p, i) => {
        p.style.outline = prevStyles[i]
        p.style.outlineOffset = ""
      })
    }, 800)
  }
})

init()

export {}
