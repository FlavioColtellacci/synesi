import type { ChatConfidence, ChatSourceTag } from "@/lib/chat/types"

export const LANDING_SIGMA_DEMO_PROMPT_LIMIT = 5
export const LANDING_SIGMA_DEMO_MAX_MESSAGE_CHARS = 360
export const LANDING_SIGMA_DEMO_RATE_LIMIT_WINDOW_MS = 12 * 60 * 60 * 1000
export const LANDING_SIGMA_DEMO_VISITOR_HEADER = "x-sigma-demo-token"

export type LandingSigmaDemoRequestBody = {
  message?: string
}

export type LandingSigmaDemoResponse = {
  answer: string
  sourceTags: ChatSourceTag[]
  confidence: ChatConfidence
  followUpActions: string[]
  promptsUsed: number
  promptsRemaining: number
  limitReached: boolean
}

export function sanitizeLandingSigmaDemoMessage(input: unknown): string | null {
  if (typeof input !== "string") return null
  const normalized = input.trim()
  if (!normalized) return null
  if (normalized.length > LANDING_SIGMA_DEMO_MAX_MESSAGE_CHARS) return null
  return normalized
}

export function getPromptsRemaining(promptsUsed: number) {
  return Math.max(0, LANDING_SIGMA_DEMO_PROMPT_LIMIT - promptsUsed)
}

export function sanitizeVisitorToken(token: string | null): string | null {
  if (!token) return null
  const normalized = token.trim()
  if (!/^[A-Za-z0-9._:-]{16,120}$/.test(normalized)) return null
  return normalized
}
