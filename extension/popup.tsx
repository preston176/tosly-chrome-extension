import { Storage } from "@plasmohq/storage"
import { useEffect, useState } from "react"

import "~/styles/popup.css"

const storage = new Storage()

const FEATURES = [
  {
    index: "01",
    title: "Automatic Detection",
    body: "Tosly detects Terms of Service and Privacy Policy pages the moment you land on them."
  },
  {
    index: "02",
    title: "AI-Powered Analysis",
    body: "Our model scans thousands of words in seconds, flagging clauses that remove your rights."
  },
  {
    index: "03",
    title: "Plain-English Results",
    body: "You see a clear risk rating and simple explanations — before you click Accept."
  }
]

export default function Popup() {
  const [autoScan, setAutoScan] = useState(true)

  useEffect(() => {
    storage.get<boolean>("autoScan").then((val) => {
      setAutoScan(val !== false)
    })
  }, [])

  const toggleAutoScan = async () => {
    const next = !autoScan
    setAutoScan(next)
    await storage.set("autoScan", next)
  }

  return (
    <div className="popup-root">
      {/* Top rule */}
      <div className="popup-top-rule" />

      {/* Header */}
      <header className="popup-header">
        <div className="popup-wordmark">
          <span className="popup-wordmark-t">T</span>osly
        </div>
        <div className="popup-tagline">Legal Risk Scanner</div>
      </header>

      {/* Divider */}
      <div className="popup-divider" />

      {/* Features */}
      <ul className="popup-features">
        {FEATURES.map((f) => (
          <li key={f.index} className="popup-feature">
            <span className="popup-feature-index">{f.index}</span>
            <div className="popup-feature-body">
              <div className="popup-feature-title">{f.title}</div>
              <div className="popup-feature-text">{f.body}</div>
            </div>
          </li>
        ))}
      </ul>

      {/* Divider */}
      <div className="popup-divider" />

      {/* Toggle */}
      <div className="popup-toggle-row">
        <div>
          <div className="popup-toggle-label">Auto-scan</div>
          <div className="popup-toggle-sub">Scan TOS pages automatically</div>
        </div>
        <button
          className={`popup-toggle ${autoScan ? "on" : "off"}`}
          onClick={toggleAutoScan}
          aria-pressed={autoScan}
          aria-label="Toggle auto-scan">
          <span className="popup-toggle-knob" />
        </button>
      </div>

      {/* Footer */}
      <footer className="popup-footer">
        <a
          href="mailto:hello@tosly.app?subject=False+Positive+Report"
          target="_blank"
          rel="noopener noreferrer"
          className="popup-footer-link">
          Report a false positive
        </a>
        <span className="popup-footer-sep">·</span>
        <span className="popup-version">v0.1</span>
      </footer>
    </div>
  )
}
