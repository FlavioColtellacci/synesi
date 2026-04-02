import type { ChatAssistantResponse } from "@/lib/chat/types"
import type { SupabaseClient } from "@supabase/supabase-js"

type PersistedRole = "user" | "assistant"

export type SigmaMemoryProfile = {
  enabled: boolean
  profile: {
    investmentFocus?: string
    monitoringPreferences?: string
    communicationStyle?: string
    notes?: string
  }
  updatedAt?: string
}

type PersistedRow = {
  id: string
  role: PersistedRole
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

type StoredChatMessage = {
  id: string
  role: PersistedRole
  content: string
  sourceTags?: ChatAssistantResponse["sourceTags"]
  confidence?: ChatAssistantResponse["confidence"]
  escalation?: ChatAssistantResponse["escalation"]
  followUpActions?: string[]
  actionDrafts?: ChatAssistantResponse["actionDrafts"]
  retrievalEvidence?: ChatAssistantResponse["retrievalEvidence"]
  webContextVerified?: boolean
  webContextSource?: ChatAssistantResponse["webContextSource"]
  webLookupTemporarilyUnavailable?: boolean
  artifacts?: ChatAssistantResponse["artifacts"]
}

const DEFAULT_SIGMA_MEMORY_PROFILE: SigmaMemoryProfile = {
  enabled: false,
  profile: {},
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function sanitizeMemoryText(value: unknown, maxChars: number) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim().replace(/\s+/g, " ")
  if (!trimmed) return undefined
  return trimmed.slice(0, maxChars)
}

function sanitizeMemoryProfile(input: unknown): SigmaMemoryProfile {
  if (!isRecord(input)) return DEFAULT_SIGMA_MEMORY_PROFILE
  const profile = isRecord(input.profile) ? input.profile : {}
  return {
    enabled: input.enabled === true,
    profile: {
      investmentFocus: sanitizeMemoryText(profile.investmentFocus, 180),
      monitoringPreferences: sanitizeMemoryText(profile.monitoringPreferences, 220),
      communicationStyle: sanitizeMemoryText(profile.communicationStyle, 120),
      notes: sanitizeMemoryText(profile.notes, 320),
    },
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined,
  }
}

function assistantMetadataFromResponse(response: ChatAssistantResponse): Record<string, unknown> {
  return {
    sourceTags: response.sourceTags,
    confidence: response.confidence,
    escalation: response.escalation,
    followUpActions: response.followUpActions,
    actionDrafts: response.actionDrafts ?? [],
    retrievalEvidence: response.retrievalEvidence ?? [],
    webContextVerified: response.webContextVerified ?? false,
    webContextSource: response.webContextSource ?? null,
    webLookupTemporarilyUnavailable: response.webLookupTemporarilyUnavailable ?? false,
    artifacts: response.artifacts ?? [],
  }
}

function mapStoredMessage(row: PersistedRow): StoredChatMessage {
  const metadata = row.metadata ?? {}

  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sourceTags: Array.isArray(metadata.sourceTags) ? (metadata.sourceTags as ChatAssistantResponse["sourceTags"]) : [],
    confidence: typeof metadata.confidence === "string" ? (metadata.confidence as ChatAssistantResponse["confidence"]) : undefined,
    escalation: typeof metadata.escalation === "string" ? (metadata.escalation as ChatAssistantResponse["escalation"]) : undefined,
    followUpActions: Array.isArray(metadata.followUpActions) ? (metadata.followUpActions as string[]) : [],
    actionDrafts: Array.isArray(metadata.actionDrafts)
      ? (metadata.actionDrafts as ChatAssistantResponse["actionDrafts"])
      : [],
    retrievalEvidence: Array.isArray(metadata.retrievalEvidence)
      ? (metadata.retrievalEvidence as ChatAssistantResponse["retrievalEvidence"])
      : [],
    webContextVerified: metadata.webContextVerified === true,
    webContextSource:
      metadata.webContextSource === "safe_link" || metadata.webContextSource === "brave_search"
        ? (metadata.webContextSource as ChatAssistantResponse["webContextSource"])
        : undefined,
    webLookupTemporarilyUnavailable: metadata.webLookupTemporarilyUnavailable === true,
    artifacts: Array.isArray(metadata.artifacts) ? (metadata.artifacts as ChatAssistantResponse["artifacts"]) : [],
  }
}

async function getOrCreateChatThreadId(supabase: SupabaseClient, userId: string) {
  const { data: existingThread, error: existingError } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (existingError) throw existingError
  if (existingThread?.id) return existingThread.id as string

  const { data: createdThread, error: createError } = await supabase
    .from("chat_threads")
    .insert({ user_id: userId, title: "Sigma conversation" })
    .select("id")
    .single()

  if (createError) throw createError
  return createdThread.id as string
}

export async function persistChatExchange(
  supabase: SupabaseClient,
  userId: string,
  userMessage: string,
  assistantResponse: ChatAssistantResponse,
) {
  const threadId = await getOrCreateChatThreadId(supabase, userId)

  const { error: insertError } = await supabase.from("chat_messages").insert([
    {
      thread_id: threadId,
      user_id: userId,
      role: "user",
      content: userMessage,
      metadata: {},
    },
    {
      thread_id: threadId,
      user_id: userId,
      role: "assistant",
      content: assistantResponse.answer,
      metadata: assistantMetadataFromResponse(assistantResponse),
    },
  ])

  if (insertError) throw insertError
}

export async function loadUserChatHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 60,
): Promise<StoredChatMessage[]> {
  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (threadError) throw threadError
  if (!thread?.id) return []

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,role,content,metadata,created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = ((data ?? []) as PersistedRow[]).reverse()
  return rows.map(mapStoredMessage)
}

export async function clearUserChatHistory(supabase: SupabaseClient, userId: string) {
  const { data: thread, error: threadError } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (threadError) throw threadError
  if (!thread?.id) return

  const { error } = await supabase.from("chat_messages").delete().eq("thread_id", thread.id)
  if (error) throw error
}

export async function getUserSigmaMemoryProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<SigmaMemoryProfile> {
  const threadId = await getOrCreateChatThreadId(supabase, userId)
  const { data, error } = await supabase
    .from("chat_threads")
    .select("memory_enabled,memory_profile,memory_profile_updated_at")
    .eq("id", threadId)
    .single()

  if (error) throw error

  return sanitizeMemoryProfile({
    enabled: data.memory_enabled === true,
    profile: data.memory_profile ?? {},
    updatedAt: data.memory_profile_updated_at ?? undefined,
  })
}

export async function updateUserSigmaMemoryProfile(
  supabase: SupabaseClient,
  userId: string,
  input: SigmaMemoryProfile,
): Promise<SigmaMemoryProfile> {
  const threadId = await getOrCreateChatThreadId(supabase, userId)
  const sanitized = sanitizeMemoryProfile(input)
  const nowIso = new Date().toISOString()

  const { error } = await supabase
    .from("chat_threads")
    .update({
      memory_enabled: sanitized.enabled,
      memory_profile: sanitized.profile,
      memory_profile_updated_at: nowIso,
    })
    .eq("id", threadId)

  if (error) throw error

  return {
    ...sanitized,
    updatedAt: nowIso,
  }
}

export async function resetUserSigmaMemoryProfile(supabase: SupabaseClient, userId: string): Promise<SigmaMemoryProfile> {
  const threadId = await getOrCreateChatThreadId(supabase, userId)

  const { error } = await supabase
    .from("chat_threads")
    .update({
      memory_enabled: false,
      memory_profile: {},
      memory_profile_updated_at: new Date().toISOString(),
    })
    .eq("id", threadId)

  if (error) throw error
  return { ...DEFAULT_SIGMA_MEMORY_PROFILE, updatedAt: new Date().toISOString() }
}

export async function syncUserReleaseRing(
  supabase: SupabaseClient,
  userId: string,
  ring: "internal" | "beta" | "full",
) {
  const threadId = await getOrCreateChatThreadId(supabase, userId)
  const { error } = await supabase.from("chat_threads").update({ release_ring: ring }).eq("id", threadId)
  if (error) throw error
}
