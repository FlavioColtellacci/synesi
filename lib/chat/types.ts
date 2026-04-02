export type ChatSourceTag = "ProductGuide" | "WorkflowGuide" | "BillingFAQ" | "PolicyGuide" | "GeneralKnowledge"

export type ChatConfidence = "high" | "medium" | "low"

export type ChatEscalation = "none" | "support" | "action_confirmation"

export type ChatActionType =
  | "open_thesis"
  | "filter_needs_review"
  | "open_alerts_panel"
  | "draft_alert_rule_update"

export type ChatActionDraft = {
  actionType: ChatActionType
  label: string
  rationale: string
  thesisId?: string
}

export type ChatExportFormat = "csv" | "docx" | "pdf" | "xlsx"

export type ChatRequestedExport = {
  format: ChatExportFormat
  label: string
}

export type ChatExportArtifact = {
  id: string
  label: string
  format: ChatExportFormat
  mimeType: string
  sizeBytes: number
  signedUrl: string
  signedUrlExpiresAt: string
}

export type ChatRetrievalEvidence = {
  source: "assumption" | "source_match" | "status_note" | "uploaded_document"
  snippet: string
}

export type ChatAssistantResponse = {
  answer: string
  sourceTags: ChatSourceTag[]
  confidence: ChatConfidence
  escalation: ChatEscalation
  followUpActions: string[]
  actionDrafts?: ChatActionDraft[]
  retrievalEvidence?: ChatRetrievalEvidence[]
  requestedExports?: ChatRequestedExport[]
  artifacts?: ChatExportArtifact[]
  webContextVerified?: boolean
  webContextSource?: "safe_link" | "brave_search"
  webLookupTemporarilyUnavailable?: boolean
}

export type ChatMessageRole = "user" | "assistant"

export type ChatRequestMessage = {
  role: ChatMessageRole
  content: string
}

export type ChatAttachmentInput = {
  id: string
}
