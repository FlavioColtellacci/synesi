import type { ChatAssistantResponse } from "@/lib/chat/types"

const SENSITIVE_PATTERNS: RegExp[] = [
  /api[_-\s]?key/i,
  /secret/i,
  /token/i,
  /service[_-\s]?role/i,
  /process\.env/i,
  /supabase[_-\s]?service/i,
  /internal prompt/i,
  /system prompt/i,
  /private roadmap/i,
  /confidential/i,
  /competitor/i,
]

const BLOCK_RESPONSE: ChatAssistantResponse = {
  answer:
    "I cannot share internal or sensitive Synesi information. I can still help with approved product workflows and public guidance.",
  sourceTags: ["PolicyGuide"],
  confidence: "high",
  escalation: "support",
  followUpActions: [
    "Ask a product workflow question",
    "Ask for public feature guidance",
    "Contact support for account-specific help",
  ],
}

export function enforceResponseGuardrails(response: ChatAssistantResponse): ChatAssistantResponse {
  const answer = response.answer.trim()
  if (!answer) return BLOCK_RESPONSE

  const leaked = SENSITIVE_PATTERNS.some((pattern) => pattern.test(answer))
  if (leaked) {
    return BLOCK_RESPONSE
  }

  return {
    ...response,
    answer,
    followUpActions: response.followUpActions.slice(0, 3),
    actionDrafts: (response.actionDrafts ?? []).slice(0, 3),
    retrievalEvidence: (response.retrievalEvidence ?? []).slice(0, 5),
    requestedExports: (response.requestedExports ?? []).slice(0, 3),
    artifacts: (response.artifacts ?? []).slice(0, 3),
  }
}

