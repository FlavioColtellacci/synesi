import type { ChatAssistantResponse } from "@/lib/chat/types"

type SensitivePatternRule = {
  reason: string
  pattern: RegExp
}

const SENSITIVE_PATTERNS: SensitivePatternRule[] = [
  {
    reason: "credential_label",
    pattern: /\b(?:api|access|auth|bearer|service[_-\s]?role)\s*(?:key|token|secret)\b/i,
  },
  {
    reason: "provider_credential_label",
    pattern: /\b(?:supabase|openai|anthropic|vercel|aws|github)[\w\s-]{0,24}(?:api[_-\s]?key|token|secret|service[_-\s]?role[_-\s]?key)\b/i,
  },
  {
    reason: "credential_value_pattern",
    pattern: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{8,}\b/,
  },
  {
    reason: "env_secret_reference",
    pattern: /\bprocess\.env\.[A-Z0-9_]{3,}\b/,
  },
  {
    reason: "prompt_leakage_format",
    pattern: /\b(?:system|internal|hidden)\s+prompt\s*(?:is|:|instructions?\s*:)/i,
  },
  {
    reason: "private_roadmap_claim",
    pattern: /\bprivate\s+roadmap\b/i,
  },
  {
    reason: "confidential_disclosure",
    pattern: /\b(?:strictly\s+)?confidential(?:\s+details?)?\b/i,
  },
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

export type GuardrailResult = {
  response: ChatAssistantResponse
  blockedByPattern: string | null
}

export function enforceResponseGuardrailsWithTelemetry(response: ChatAssistantResponse): GuardrailResult {
  const answer = response.answer.trim()
  if (!answer) {
    return {
      response: BLOCK_RESPONSE,
      blockedByPattern: "empty_answer",
    }
  }

  const leaked = SENSITIVE_PATTERNS.find((rule) => rule.pattern.test(answer))
  if (leaked) {
    return {
      response: BLOCK_RESPONSE,
      blockedByPattern: leaked.reason,
    }
  }

  return {
    response: {
      ...response,
      answer,
      followUpActions: response.followUpActions.slice(0, 3),
      actionDrafts: (response.actionDrafts ?? []).slice(0, 3),
      retrievalEvidence: (response.retrievalEvidence ?? []).slice(0, 5),
      requestedExports: (response.requestedExports ?? []).slice(0, 3),
      artifacts: (response.artifacts ?? []).slice(0, 3),
    },
    blockedByPattern: null,
  }
}

export function enforceResponseGuardrails(response: ChatAssistantResponse): ChatAssistantResponse {
  return enforceResponseGuardrailsWithTelemetry(response).response
}

