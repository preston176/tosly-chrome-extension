import { Storage } from "@plasmohq/storage"
import type { AnalysisResult } from "~types"

const storage = new Storage()
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const BACKEND_URL = process.env.PLASMO_PUBLIC_BACKEND_URL

interface CachedEntry {
  result: AnalysisResult
  cachedAt: number
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

async function getCached(domain: string): Promise<AnalysisResult | null> {
  const entry = await storage.get<CachedEntry>(domain)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > TTL_MS) {
    await storage.remove(domain)
    return null
  }
  return entry.result
}

async function setCached(domain: string, result: AnalysisResult): Promise<void> {
  const entry: CachedEntry = { result, cachedAt: Date.now() }
  await storage.set(domain, entry)
}

async function fetchAnalysis(url: string, text: string): Promise<AnalysisResult> {
  const response = await fetch(`${BACKEND_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, text })
  })
  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`)
  }
  return response.json()
}

// Safe wrapper: chrome.tabs.sendMessage throws on tabs without content scripts (e.g. chrome:// pages)
function sendToTab(tabId: number, message: unknown): void {
  chrome.tabs.sendMessage(tabId, message).catch(() => {
    // Tab may not have content script — silently ignore
  })
}

chrome.runtime.onMessage.addListener((message, sender, _sendResponse) => {
  if (message.type === "ANALYZE") {
    const { url, text } = message.payload
    const domain = extractDomain(url)

    ;(async () => {
      const tabId = sender.tab?.id
      if (tabId) sendToTab(tabId, { type: "SCANNING" })

      try {
        let result = await getCached(domain)

        if (!result) {
          result = await fetchAnalysis(url, text)
          await setCached(domain, result)
        }

        if (tabId) sendToTab(tabId, { type: "RESULT", payload: result })
      } catch (err) {
        console.error("[Tosly] Analysis failed:", err)
        if (tabId) sendToTab(tabId, { type: "ERROR", payload: { message: "Analysis failed. Please try again." } })
      }
    })()

    return true // keep message channel open for async
  }
})

export {}
