import type {
  ChatActionDraft,
  ChatAssistantResponse,
  ChatConfidence,
  ChatEscalation,
  ChatRetrievalEvidence,
  ChatRequestMessage,
  ChatSourceTag,
} from "@/lib/chat/types"

const SOURCE_TAGS: ChatSourceTag[] = [
  "ProductGuide",
  "WorkflowGuide",
  "BillingFAQ",
  "PolicyGuide",
  "GeneralKnowledge",
]

const CONFIDENCE_VALUES: ChatConfidence[] = ["high", "medium", "low"]
const ESCALATION_VALUES: ChatEscalation[] = ["none", "support", "action_confirmation"]
const ACTION_TYPES: ChatActionDraft["actionType"][] = [
  "open_thesis",
  "filter_needs_review",
  "open_alerts_panel",
  "draft_alert_rule_update",
]
const RETRIEVAL_SOURCES: ChatRetrievalEvidence["source"][] = ["assumption", "source_match", "status_note"]

/** Upper bound for stored/displayed answer text (runaway or malformed model output). */
const MAX_ASSISTANT_ANSWER_CHARS = 32_000

function limitAssistantAnswerLength(text: string): string {
  if (text.length <= MAX_ASSISTANT_ANSWER_CHARS) return text
  return `${text.slice(0, MAX_ASSISTANT_ANSWER_CHARS - 1)}…`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function sanitizeTags(input: unknown): ChatSourceTag[] {
  if (!Array.isArray(input)) return ["GeneralKnowledge"]
  const filtered = input.filter((tag): tag is ChatSourceTag => SOURCE_TAGS.includes(tag as ChatSourceTag))
  return filtered.length > 0 ? filtered : ["GeneralKnowledge"]
}

function sanitizeConfidence(input: unknown): ChatConfidence {
  return CONFIDENCE_VALUES.includes(input as ChatConfidence) ? (input as ChatConfidence) : "low"
}

function sanitizeEscalation(input: unknown): ChatEscalation {
  return ESCALATION_VALUES.includes(input as ChatEscalation) ? (input as ChatEscalation) : "none"
}

function sanitizeActions(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3)
}

function sanitizeActionDrafts(input: unknown): ChatActionDraft[] {
  if (!Array.isArray(input)) return []
  const actionDrafts: ChatActionDraft[] = []

  for (const item of input) {
    if (!isRecord(item)) continue
    const actionType = ACTION_TYPES.includes(item.actionType as ChatActionDraft["actionType"])
      ? (item.actionType as ChatActionDraft["actionType"])
      : null
    if (!actionType) continue

    const label = typeof item.label === "string" ? item.label.trim().slice(0, 80) : ""
    const rationale = typeof item.rationale === "string" ? item.rationale.trim().slice(0, 240) : ""
    if (!label || !rationale) continue

    const draft: ChatActionDraft = { actionType, label, rationale }
    if (typeof item.thesisId === "string" && item.thesisId.trim().length > 0) {
      draft.thesisId = item.thesisId.trim().slice(0, 120)
    }
    actionDrafts.push(draft)
    if (actionDrafts.length >= 3) break
  }

  return actionDrafts
}

function sanitizeRetrievalEvidence(input: unknown): ChatRetrievalEvidence[] {
  if (!Array.isArray(input)) return []
  const evidences: ChatRetrievalEvidence[] = []

  for (const item of input) {
    if (!isRecord(item)) continue
    const source = RETRIEVAL_SOURCES.includes(item.source as ChatRetrievalEvidence["source"])
      ? (item.source as ChatRetrievalEvidence["source"])
      : null
    const snippet = typeof item.snippet === "string" ? item.snippet.trim().slice(0, 220) : ""
    if (!source || !snippet) continue
    evidences.push({ source, snippet })
    if (evidences.length >= 5) break
  }

  return evidences
}

function stripCodeFences(input: string): string {
  return input
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()
}

function extractFirstJsonObject(input: string): string | null {
  const startIndex = input.indexOf("{")
  if (startIndex === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === "\\") {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === "{") {
      depth += 1
      continue
    }

    if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return input.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

export function parseStructuredPayload(rawText: string): Record<string, unknown> | null {
  const cleaned = stripCodeFences(rawText)
  if (!cleaned) return null

  try {
    const parsed = JSON.parse(cleaned) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    const jsonCandidate = extractFirstJsonObject(cleaned)
    if (!jsonCandidate) return null

    try {
      const parsed = JSON.parse(jsonCandidate) as unknown
      return isRecord(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}

function normalizeAnswerText(input: string): string {
  let text = input.replace(/\r\n/g, "\n").trim()

  text = text
    .replace(/```[a-zA-Z]*\n?/g, "")
    .replace(/```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")

  // Help readability when the model returns packed inline steps.
  text = text
    .replace(/([^\n])(\d+\.\s)/g, "$1\n$2")
    .replace(/\s-\s(?=\S)/g, "\n- ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")

  return text.trim()
}

export function parseAssistantResponse(rawText: string): ChatAssistantResponse | null {
  const parsed = parseStructuredPayload(rawText)
  if (!parsed) return null

  const answer = typeof parsed.answer === "string" ? limitAssistantAnswerLength(normalizeAnswerText(parsed.answer)) : ""
  if (!answer) return null

  return {
    answer,
    sourceTags: sanitizeTags(parsed.sourceTags),
    confidence: sanitizeConfidence(parsed.confidence),
    escalation: sanitizeEscalation(parsed.escalation),
    followUpActions: sanitizeActions(parsed.followUpActions),
    actionDrafts: sanitizeActionDrafts(parsed.actionDrafts),
    retrievalEvidence: sanitizeRetrievalEvidence(parsed.retrievalEvidence),
  }
}

export function parseAssistantTextFallback(rawText: string): ChatAssistantResponse | null {
  const parsed = parseStructuredPayload(rawText)
  if (parsed && typeof parsed.answer === "string") {
    const answer = limitAssistantAnswerLength(normalizeAnswerText(parsed.answer))
    if (!answer) return null

    return {
      answer,
      sourceTags: sanitizeTags(parsed.sourceTags),
      confidence: sanitizeConfidence(parsed.confidence),
      escalation: sanitizeEscalation(parsed.escalation),
      followUpActions: sanitizeActions(parsed.followUpActions),
      actionDrafts: sanitizeActionDrafts(parsed.actionDrafts),
      retrievalEvidence: sanitizeRetrievalEvidence(parsed.retrievalEvidence),
    }
  }

  const cleaned = stripCodeFences(rawText)

  if (!cleaned) return null

  const answer = limitAssistantAnswerLength(normalizeAnswerText(cleaned))
  if (!answer) return null

  return {
    answer,
    sourceTags: ["GeneralKnowledge"],
    confidence: "medium",
    escalation: "none",
    followUpActions: [],
  }
}

export function normalizeHistory(messages: ChatRequestMessage[]): ChatRequestMessage[] {
  return messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .slice(-8)
}
