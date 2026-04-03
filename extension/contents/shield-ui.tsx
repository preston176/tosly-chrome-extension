import cssText from "data-text:~/styles/shield.css"
import type { PlasmoCSConfig, PlasmoGetShadowHostId } from "plasmo"
import { useEffect, useRef, useState } from "react"

import type { AnalysisResult, ShieldState } from "~types"

import ResultPanel from "~components/result-panel"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

export const getShadowHostId: PlasmoGetShadowHostId = () => "tosly-shield-host"

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const STATE_COLORS: Record<ShieldState, string> = {
  idle: "#6b7280",
  scanning: "#6b7280",
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e"
}

const STATE_LABEL: Record<ShieldState, string> = {
  idle: "TOSLY",
  scanning: "SCANNING",
  red: "HIGH RISK",
  yellow: "CAUTION",
  green: "CLEAR"
}

function ShieldIcon({ state }: { state: ShieldState }) {
  const color = STATE_COLORS[state]
  const isScanning = state === "scanning"

  return (
    <svg
      width="32"
      height="36"
      viewBox="0 0 32 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={isScanning ? "tosly-pulse" : ""}
      style={{ filter: state !== "idle" && state !== "scanning" ? `drop-shadow(0 0 6px ${color}60)` : "none" }}>
      <path
        d="M16 2L3 7V18C3 25.18 8.64 31.9 16 34C23.36 31.9 29 25.18 29 18V7L16 2Z"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {state === "scanning" && (
        <path
          d="M16 2L3 7V18C3 25.18 8.64 31.9 16 34C23.36 31.9 29 25.18 29 18V7L16 2Z"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeDasharray="4 4"
          className="tosly-spin"
        />
      )}
      {state === "red" && (
        <>
          <line x1="16" y1="12" x2="16" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="24" r="1.5" fill={color} />
        </>
      )}
      {state === "yellow" && (
        <path
          d="M16 12L16 22M16 25V25.5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      {state === "green" && (
        <path
          d="M11 18L14.5 21.5L21 14"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

export default function ShieldUI() {
  const [state, setState] = useState<ShieldState>("idle")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const labelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Small delay before showing to avoid flash on every page
    const t = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const handler = (message: any) => {
      if (message.type === "SCANNING") {
        setState("scanning")
        setResult(null)
        setPanelOpen(false)
      } else if (message.type === "RESULT") {
        const r: AnalysisResult = message.payload
        setState(r.severity)
        setResult(r)
        // Auto-open panel for red and yellow
        if (r.severity === "red" || r.severity === "yellow") {
          setTimeout(() => setPanelOpen(true), 400)
        }
      } else if (message.type === "ERROR") {
        setState("idle")
      } else if (message.type === "IDLE_WITH_CHECKBOX") {
        setState("idle")
      }
    }

    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  const handleClick = () => {
    if (state === "idle") {
      // Manual trigger
      chrome.runtime.sendMessage({ type: "MANUAL_SCAN" })
    } else if (result) {
      setPanelOpen((prev) => !prev)
    }
  }

  if (!visible) return null

  return (
    <div className="tosly-root">
      {panelOpen && result && (
        <ResultPanel
          result={result}
          onDismiss={() => setPanelOpen(false)}
        />
      )}
      <button
        className={`tosly-shield-btn ${state}`}
        onClick={handleClick}
        title={`Tosly — ${STATE_LABEL[state]}`}
        aria-label={`Tosly: ${STATE_LABEL[state]}`}>
        <ShieldIcon state={state} />
        <span className="tosly-label">{STATE_LABEL[state]}</span>
      </button>
    </div>
  )
}
