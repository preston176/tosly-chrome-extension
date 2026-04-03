import { Storage } from "@plasmohq/storage"

const storage = new Storage()
const MAX_TEXT_LENGTH = 50_000

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

function isTosPage(): boolean {
  const path = window.location.pathname + window.location.search
  if (TOS_PATH_PATTERNS.some((re) => re.test(path))) return true
  if (TOS_TITLE_PATTERNS.some((re) => re.test(document.title))) return true
  return false
}

function hasConsentCheckbox(): boolean {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]')
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
  return val !== false // default to enabled
}

async function init() {
  const autoScan = await isAutoScanEnabled()

  if (autoScan && isTosPage()) {
    // Small delay to let the page finish rendering
    setTimeout(triggerScan, 1500)
    return
  }

  // For checkout/signup pages with consent checkboxes — manual trigger via shield
  if (hasConsentCheckbox()) {
    // Shield starts in idle state; user clicks to trigger
    chrome.runtime.sendMessage({ type: "IDLE_WITH_CHECKBOX" })
  }
}

// Listen for manual trigger from shield UI
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "MANUAL_SCAN") {
    triggerScan()
  }
})

init()

export {}
