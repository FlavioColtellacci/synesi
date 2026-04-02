import type { SigmaActionDraft } from "@/lib/chat/actions"

export type SigmaMonitorRiskLevel = "stable" | "watch" | "critical"
export type SigmaMonitorStatus = "running" | "success" | "failed"
export type SigmaMonitorTriggerSource = "manual" | "cron"

export type SigmaMonitorSnapshotMeta = {
  thesisStatusById: Record<string, string>
  openEventKeys: string[]
}

export type SigmaMonitorDelta = {
  comparedToRunKey: string | null
  newAlertCount: number
  resolvedAlertCount: number
  statusChangeCount: number
  changed: boolean
  summaryLine: string
}

export type SigmaMonitorSummary = {
  headline: string
  summary: string
  riskLevel: SigmaMonitorRiskLevel
  highSignalChanges: string[]
  recommendedActions: SigmaActionDraft[]
  evidenceSnippets: string[]
  delta?: SigmaMonitorDelta
  snapshotMeta?: SigmaMonitorSnapshotMeta
}

export type SigmaMonitorRunRow = {
  id: string
  user_id: string
  run_key: string
  trigger_source: SigmaMonitorTriggerSource
  status: SigmaMonitorStatus
  summary: SigmaMonitorSummary | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type SigmaMonitorSnapshot = {
  id: string
  runKey: string
  triggerSource: SigmaMonitorTriggerSource
  status: SigmaMonitorStatus
  summary: SigmaMonitorSummary | null
  completedAt: string | null
  createdAt: string
}
