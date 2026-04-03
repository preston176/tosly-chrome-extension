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

function FlagRow({ flag }: { flag: Flag }) {
  const cfg = SEVERITY_CONFIG[flag.severity as Severity] ?? SEVERITY_CONFIG.green

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)"
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
              color: "#d1d5db",
              fontFamily: "inherit",
              textTransform: "uppercase"
            }}>
            {flag.category}
          </span>
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
              flexShrink: 0,
              fontFamily: "inherit"
            }}>
            {cfg.label}
          </span>
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
      </div>
    </div>
  )
}

interface ResultPanelProps {
  result: AnalysisResult
  onDismiss: () => void
}

export default function ResultPanel({ result, onDismiss }: ResultPanelProps) {
  const cfg = SEVERITY_CONFIG[result.severity]

  return (
    <div
      style={{
        position: "fixed",
        bottom: 72,
        right: 16,
        width: 320,
        maxHeight: 480,
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

      {/* Flags */}
      {result.flags.length > 0 && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 16px",
            minHeight: 0
          }}>
          {result.flags.map((flag, i) => (
            <FlagRow key={i} flag={flag} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          flexShrink: 0
        }}>
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
            ;(e.target as HTMLElement).style.color = "#d1d5db"
            ;(e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.25)"
          }}
          onMouseLeave={(e) => {
            ;(e.target as HTMLElement).style.color = "#6b7280"
            ;(e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"
          }}>
          Got it
        </button>
      </div>
    </div>
  )
}
