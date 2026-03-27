export type ChatSourceTag = "ProductGuide" | "WorkflowGuide" | "BillingFAQ" | "PolicyGuide" | "GeneralKnowledge"

export type ChatConfidence = "high" | "medium" | "low"

export type ChatEscalation = "none" | "support" | "action_confirmation"

export type ChatAssistantResponse = {
  answer: string
  sourceTags: ChatSourceTag[]
  confidence: ChatConfidence
  escalation: ChatEscalation
  followUpActions: string[]
  webContextVerified?: boolean
}

export type ChatMessageRole = "user" | "assistant"

export type ChatRequestMessage = {
  role: ChatMessageRole
  content: string
}
