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
