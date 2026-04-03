import cssText from "data-text:~/styles/shield.css"
import { Storage } from "@plasmohq/storage"
import type { PlasmoCSConfig, PlasmoGetShadowHostId } from "plasmo"
import { useCallback, useEffect, useRef, useState } from "react"

import type { AnalysisResult, ShieldState } from "~types"

import ResultPanel from "~components/result-panel"

const storage = new Storage({ area: "local" })

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

const POS_KEY = "tosly-widget-pos"
const DEFAULT_POS = { x: window.innerWidth - 80, y: window.innerHeight - 100 }

function clampPos(pos: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, pos.x), window.innerWidth - 72),
    y: Math.min(Math.max(0, pos.y), window.innerHeight - 80)
  }
}

async function loadPos(): Promise<{ x: number; y: number }> {
  const saved = await storage.get<{ x: number; y: number }>(POS_KEY)
  return saved ? clampPos(saved) : DEFAULT_POS
}

function savePos(pos: { x: number; y: number }) {
  storage.set(POS_KEY, pos).catch(() => {})
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
        <path d="M16 12L16 22M16 25V25.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
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
  const [pos, setPos] = useState<{ x: number; y: number }>(DEFAULT_POS)

  // Drag state — all in a ref so pointer handlers don't need re-binding
  const dragRef = useRef({
    dragging: false,
    startPointerX: 0,
    startPointerY: 0,
    startElemX: 0,
    startElemY: 0,
    moved: false
  })

  useEffect(() => {
    loadPos().then((p) => {
      setPos(p)
      setVisible(true)
    })
  }, [])

  useEffect(() => {
    const handler = (message: any) => {
      if (message.type === "SCANNING") {
        setState("scanning")
        setResult(null)
        setPanelOpen(false)
      } else if (message.type === "RESULT") {
        if (message.url && message.url !== window.location.href) return
        const r: AnalysisResult = message.payload
        setState(r.severity)
        setResult(r)
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

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    // Only primary button
    if (e.button !== 0) return
    const d = dragRef.current
    d.dragging = true
    d.moved = false
    d.startPointerX = e.clientX
    d.startPointerY = e.clientY
    d.startElemX = pos.x
    d.startElemY = pos.y
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [pos])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d.dragging) return

    const dx = e.clientX - d.startPointerX
    const dy = e.clientY - d.startPointerY

    // Only start moving after 4px threshold to preserve click intent
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return
    d.moved = true

    const newX = Math.min(Math.max(0, d.startElemX + dx), window.innerWidth - 72)
    const newY = Math.min(Math.max(0, d.startElemY + dy), window.innerHeight - 80)

    setPos({ x: newX, y: newY })
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d.dragging) return
    d.dragging = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)

    if (d.moved) {
      // Save final position and suppress the click
      savePos(pos)
    }
  }, [pos])

  const handleClick = useCallback(() => {
    // Suppress click if this was a drag
    if (dragRef.current.moved) {
      dragRef.current.moved = false
      return
    }
    if (state === "idle") {
      chrome.runtime.sendMessage({ type: "MANUAL_SCAN" })
    } else if (result) {
      const next = !panelOpen
      setPanelOpen(next)
      if (!next) chrome.runtime.sendMessage({ type: "CLEAR_HIGHLIGHTS" })
    }
  }, [state, result, panelOpen])

  if (!visible) return null

  // Panel opens above or below depending on vertical position
  const panelAbove = pos.y > window.innerHeight / 2

  return (
    <div
      className="tosly-root"
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 2147483647, isolation: "isolate" }}>
      {panelOpen && result && (
        <ResultPanel
          result={result}
          anchorAbove={panelAbove}
          onDismiss={() => {
            setPanelOpen(false)
            chrome.runtime.sendMessage({ type: "CLEAR_HIGHLIGHTS" })
          }}
        />
      )}
      <button
        className={`tosly-shield-btn ${state}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={handleClick}
        title={`Tosly — ${STATE_LABEL[state]}`}
        aria-label={`Tosly: ${STATE_LABEL[state]}`}
        style={{ cursor: dragRef.current.dragging ? "grabbing" : "grab" }}>
        <ShieldIcon state={state} />
        <span className="tosly-label">{STATE_LABEL[state]}</span>
      </button>
    </div>
  )
}
