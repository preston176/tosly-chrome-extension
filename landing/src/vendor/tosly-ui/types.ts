/* GENERATED FILE, DO NOT EDIT.
 * Copied from extension/types.ts by landing/scripts/sync-extension-ui.mjs
 * Edit the extension source, then run: bun run sync-ui
 */
export type Severity = "red" | "yellow" | "green"

export interface Flag {
  category: string
  severity: Severity
  explanation: string
  quote?: string
}

export interface AnalysisResult {
  severity: Severity
  summary: string
  flags: Flag[]
}

export type ShieldState = "idle" | "scanning" | Severity
