import { useState } from "react"
import type { AnalysisResult, Flag, Severity } from "~types"

const SEVERITY_CONFIG = {
  red: {
    label: "HIGH RISK",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.2)"
  },
  yellow: {
    label: "CAUTION",
    color: "#eab308",
    bg: "rgba(234,179,8,0.08)",
    border: "rgba(234,179,8,0.2)"
  },
  green: {
    label: "CLEAR",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.2)"
  }
}

function SeverityDot({ severity }: { severity: Severity }) {
  const color = SEVERITY_CONFIG[severity].color
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        backgroundColor: color,
        boxShadow: `0 0 4px ${color}80`,
        flexShrink: 0,
        marginTop: 5
      }}
    />
  )
}

function FlagRow({
  flag,
  index,
  active,
  hasHighlight,
  onClick
}: {
  flag: Flag
  index: number
  active: boolean
  hasHighlight: boolean
  onClick: () => void
}) {
  const cfg = SEVERITY_CONFIG[flag.severity as Severity] ?? SEVERITY_CONFIG.green

  return (
    <div
      onClick={hasHighlight ? onClick : undefined}
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        cursor: hasHighlight ? "pointer" : "default",
        borderRadius: 4,
        transition: "background 0.1s",
        background: active ? "rgba(255,255,255,0.04)" : "transparent",
        margin: "0 -6px",
        padding: "10px 6px"
      }}>
      <SeverityDot severity={flag.severity as Severity} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 3
          }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: active ? "#f9fafb" : "#d1d5db",
              fontFamily: "inherit",
              textTransform: "uppercase"
            }}>
            {flag.category}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            {hasHighlight && (
              <span
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.25)",
                  fontFamily: "inherit"
                }}>
                #{index + 1}
              </span>
            )}
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: cfg.color,
                backgroundColor: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 3,
                padding: "1px 5px",
                fontFamily: "inherit"
              }}>
              {cfg.label}
            </span>
          </div>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "#9ca3af",
            lineHeight: 1.45,
            fontFamily: "inherit"
          }}>
          {flag.explanation}
        </p>
        {active && flag.quote && (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
              lineHeight: 1.4,
              fontFamily: "inherit",
              fontStyle: "italic",
              borderLeft: `2px solid ${cfg.color}60`,
              paddingLeft: 7
            }}>
            "{flag.quote.length > 120 ? flag.quote.slice(0, 120) + "…" : flag.quote}"
          </p>
        )}
      </div>
    </div>
  )
}

interface ResultPanelProps {
  result: AnalysisResult
  onDismiss: () => void
  anchorAbove?: boolean
}

export default function ResultPanel({ result, onDismiss, anchorAbove = true }: ResultPanelProps) {
  const cfg = SEVERITY_CONFIG[result.severity]
  const highlightableFlags = result.flags.filter((f) => f.quote)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  function scrollTo(flagIndex: number) {
    setActiveIndex(flagIndex)
    chrome.runtime.sendMessage({ type: "SCROLL_TO_HIGHLIGHT", index: flagIndex })
  }

  function prev() {
    const next = activeIndex === null ? highlightableFlags.length - 1 : Math.max(0, activeIndex - 1)
    scrollTo(next)
  }

  function next() {
    const n = activeIndex === null ? 0 : Math.min(highlightableFlags.length - 1, activeIndex + 1)
    scrollTo(n)
  }

  // Map flag list index → highlight index (only flags with quotes get a highlight number)
  const highlightIndexMap = new Map<number, number>()
  let hi = 0
  result.flags.forEach((f, i) => { if (f.quote) highlightIndexMap.set(i, hi++) })

  return (
    <div
      style={{
        position: "absolute",
        ...(anchorAbove ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }),
        right: 0,
        width: 320,
        maxHeight: 500,
        zIndex: 2147483646,
        display: "flex",
        flexDirection: "column",
        borderRadius: 10,
        overflow: "hidden",
        background: "rgba(10,10,12,0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
        fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        animation: "tosly-slide-up 0.2s ease-out"
      }}>

      {/* Header */}
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: cfg.color,
              boxShadow: `0 0 8px ${cfg.color}`
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: cfg.color,
              textTransform: "uppercase"
            }}>
            {cfg.label}
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.25)",
            textTransform: "uppercase"
          }}>
          TOSLY
        </span>
      </div>

      {/* Summary */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0
        }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "#e5e7eb",
            lineHeight: 1.5,
            fontStyle: "italic"
          }}>
          {result.summary}
        </p>
      </div>

      {/* Flags list */}
      {result.flags.length > 0 && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 10px",
            minHeight: 0
          }}>
          {result.flags.map((flag, i) => {
            const hIdx = highlightIndexMap.get(i) ?? -1
            return (
              <FlagRow
                key={i}
                flag={flag}
                index={hIdx}
                active={activeIndex !== null && hIdx === activeIndex}
                hasHighlight={hIdx >= 0}
                onClick={() => scrollTo(hIdx)}
              />
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0
        }}>

        {/* Highlight navigator */}
        {highlightableFlags.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button
              onClick={prev}
              disabled={activeIndex === 0}
              style={{
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "5px 0 0 5px",
                cursor: activeIndex === 0 ? "default" : "pointer",
                color: activeIndex === 0 ? "rgba(255,255,255,0.2)" : "#6b7280",
                transition: "color 0.15s, border-color 0.15s",
                fontFamily: "inherit"
              }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M5.5 1.5L2.5 4.5L5.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div
              style={{
                height: 26,
                padding: "0 8px",
                display: "flex",
                alignItems: "center",
                border: "1px solid rgba(255,255,255,0.1)",
                borderLeft: "none",
                borderRight: "none",
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                fontFamily: "inherit",
                letterSpacing: "0.06em",
                minWidth: 44,
                justifyContent: "center"
              }}>
              {activeIndex === null ? `${highlightableFlags.length} found` : `${activeIndex + 1} / ${highlightableFlags.length}`}
            </div>
            <button
              onClick={next}
              disabled={activeIndex === highlightableFlags.length - 1}
              style={{
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "0 5px 5px 0",
                cursor: activeIndex === highlightableFlags.length - 1 ? "default" : "pointer",
                color: activeIndex === highlightableFlags.length - 1 ? "rgba(255,255,255,0.2)" : "#6b7280",
                transition: "color 0.15s, border-color 0.15s",
                fontFamily: "inherit"
              }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M3.5 1.5L6.5 4.5L3.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ) : (
          <div />
        )}

        <button
          onClick={onDismiss}
          style={{
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            color: "#6b7280",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 5,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "color 0.15s, border-color 0.15s"
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.color = "#d1d5db"
            el.style.borderColor = "rgba(255,255,255,0.25)"
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.color = "#6b7280"
            el.style.borderColor = "rgba(255,255,255,0.1)"
          }}>
          Got it
        </button>
      </div>
    </div>
  )
}
