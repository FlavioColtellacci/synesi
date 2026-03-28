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

export type ChatRetrievalEvidence = {
  source: "assumption" | "source_match" | "status_note"
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
  webContextVerified?: boolean
  webContextSource?: "safe_link" | "brave_search"
  webLookupTemporarilyUnavailable?: boolean
}

export type ChatMessageRole = "user" | "assistant"

export type ChatRequestMessage = {
  role: ChatMessageRole
  content: string
}
