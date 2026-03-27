import type {
  ChatAssistantResponse,
  ChatConfidence,
  ChatEscalation,
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
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as unknown
    if (!isRecord(parsed)) return null

    const answer = typeof parsed.answer === "string" ? normalizeAnswerText(parsed.answer) : ""
    if (!answer) return null

    return {
      answer,
      sourceTags: sanitizeTags(parsed.sourceTags),
      confidence: sanitizeConfidence(parsed.confidence),
      escalation: sanitizeEscalation(parsed.escalation),
      followUpActions: sanitizeActions(parsed.followUpActions),
    }
  } catch {
    return null
  }
}

export function parseAssistantTextFallback(rawText: string): ChatAssistantResponse | null {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()

  if (!cleaned) return null

  const answer = normalizeAnswerText(cleaned).slice(0, 1200)
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
