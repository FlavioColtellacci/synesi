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

export type StoredChatMessage = {
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

/**
 * Primary thread = the user's oldest chat_threads row (created_at ASC).
 * Used for Sigma memory profile and release_ring sync. The floating panel uses its own thread (see `fab-session.ts`).
 * Newer Sigma workspace threads are secondary until promoted (not implemented here).
 */
export async function verifyThreadBelongsToUser(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data?.id)
}

const CHAT_THREAD_UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

export type ResolveOptionalThreadIdResult =
  | { ok: true; threadId: string | undefined }
  | { ok: false; status: 400 | 403; error: string }

/** Empty / missing → primary thread; non-empty → validate UUID and ownership. */
export async function resolveOptionalThreadIdForUser(
  supabase: SupabaseClient,
  userId: string,
  raw: unknown,
): Promise<ResolveOptionalThreadIdResult> {
  const trimmed = typeof raw === "string" ? raw.trim() : ""
  if (trimmed === "") return { ok: true, threadId: undefined }
  if (!CHAT_THREAD_UUID_RE.test(trimmed)) {
    return { ok: false, status: 400, error: "Invalid threadId" }
  }
  const allowed = await verifyThreadBelongsToUser(supabase, userId, trimmed)
  if (!allowed) {
    return { ok: false, status: 403, error: "Chat thread not found or access denied" }
  }
  return { ok: true, threadId: trimmed }
}

async function getOldestThreadIdForUser(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.id ? (data.id as string) : null
}

/** Oldest thread for the user, creating one if none exist (write paths / FAB default). */
export async function getPrimaryThreadIdForUser(supabase: SupabaseClient, userId: string): Promise<string> {
  const existingId = await getOldestThreadIdForUser(supabase, userId)
  if (existingId) return existingId

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
  threadId?: string,
) {
  let resolvedThreadId: string
  if (threadId !== undefined && threadId !== "") {
    const allowed = await verifyThreadBelongsToUser(supabase, userId, threadId)
    if (!allowed) {
      throw new Error("Chat thread not found or access denied")
    }
    resolvedThreadId = threadId
  } else {
    resolvedThreadId = await getPrimaryThreadIdForUser(supabase, userId)
  }

  const { error: insertError } = await supabase.from("chat_messages").insert([
    {
      thread_id: resolvedThreadId,
      user_id: userId,
      role: "user",
      content: userMessage,
      metadata: {},
    },
    {
      thread_id: resolvedThreadId,
      user_id: userId,
      role: "assistant",
      content: assistantResponse.answer,
      metadata: assistantMetadataFromResponse(assistantResponse),
    },
  ])

  if (insertError) throw insertError
}

export async function loadChatHistoryForThread(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  limit = 60,
): Promise<StoredChatMessage[]> {
  const allowed = await verifyThreadBelongsToUser(supabase, userId, threadId)
  if (!allowed) {
    throw new Error("Chat thread not found or access denied")
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,role,content,metadata,created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = ((data ?? []) as PersistedRow[]).reverse()
  return rows.map(mapStoredMessage)
}

/** Loads history for the primary (oldest) thread only; does not create a thread. */
export async function loadUserChatHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 60,
): Promise<StoredChatMessage[]> {
  const threadId = await getOldestThreadIdForUser(supabase, userId)
  if (!threadId) return []
  return loadChatHistoryForThread(supabase, userId, threadId, limit)
}

export async function clearChatHistoryForThread(supabase: SupabaseClient, userId: string, threadId: string) {
  const allowed = await verifyThreadBelongsToUser(supabase, userId, threadId)
  if (!allowed) {
    throw new Error("Chat thread not found or access denied")
  }

  const { error } = await supabase.from("chat_messages").delete().eq("thread_id", threadId)
  if (error) throw error
}

/** Clears messages on the primary (oldest) thread only; does not create a thread. */
export async function clearUserChatHistory(supabase: SupabaseClient, userId: string) {
  const threadId = await getOldestThreadIdForUser(supabase, userId)
  if (!threadId) return
  await clearChatHistoryForThread(supabase, userId, threadId)
}

/** Memory profile is stored on the primary (oldest) thread only; Sigma full-page secondary threads do not carry it. */
export async function getUserSigmaMemoryProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<SigmaMemoryProfile> {
  const threadId = await getPrimaryThreadIdForUser(supabase, userId)
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
  const threadId = await getPrimaryThreadIdForUser(supabase, userId)
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
  const threadId = await getPrimaryThreadIdForUser(supabase, userId)

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
  const threadId = await getPrimaryThreadIdForUser(supabase, userId)
  const { error } = await supabase.from("chat_threads").update({ release_ring: ring }).eq("id", threadId)
  if (error) throw error
}
