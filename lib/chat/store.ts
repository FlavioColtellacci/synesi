import type { ChatAssistantResponse } from "@/lib/chat/types"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Firestore } from "firebase-admin/firestore"
import { newDocumentId, toFirestorePayload } from "@/lib/data/firestore-utils"

type PersistedRole = "user" | "assistant"
type ChatStoreBackend = SupabaseClient | Firestore

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

function isFirestoreBackend(backend: ChatStoreBackend): backend is Firestore {
  return "collection" in backend
}

function nowIso() {
  return new Date().toISOString()
}

async function touchThreadUpdatedAt(
  backend: ChatStoreBackend,
  threadId: string,
  fallbackUserId?: string,
) {
  const nextUpdatedAt = nowIso()
  if (isFirestoreBackend(backend)) {
    await backend
      .collection("chat_threads")
      .doc(threadId)
      .set(toFirestorePayload({ updated_at: nextUpdatedAt }), { merge: true })
    return
  }

  let query = backend.from("chat_threads").update({ updated_at: nextUpdatedAt }).eq("id", threadId)
  if (fallbackUserId) {
    query = query.eq("user_id", fallbackUserId)
  }
  await query
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
  backend: ChatStoreBackend,
  userId: string,
  threadId: string,
): Promise<boolean> {
  if (isFirestoreBackend(backend)) {
    const snapshot = await backend.collection("chat_threads").doc(threadId).get()
    if (!snapshot.exists) return false
    const row = (snapshot.data() ?? {}) as Record<string, unknown>
    return typeof row.user_id === "string" && row.user_id === userId
  }

  const { data, error } = await backend
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
  backend: ChatStoreBackend,
  userId: string,
  raw: unknown,
): Promise<ResolveOptionalThreadIdResult> {
  const trimmed = typeof raw === "string" ? raw.trim() : ""
  if (trimmed === "") return { ok: true, threadId: undefined }
  if (!CHAT_THREAD_UUID_RE.test(trimmed)) {
    return { ok: false, status: 400, error: "Invalid threadId" }
  }
  const allowed = await verifyThreadBelongsToUser(backend, userId, trimmed)
  if (!allowed) {
    return { ok: false, status: 403, error: "Chat thread not found or access denied" }
  }
  return { ok: true, threadId: trimmed }
}

async function getOldestThreadIdForUser(backend: ChatStoreBackend, userId: string): Promise<string | null> {
  if (isFirestoreBackend(backend)) {
    const snapshot = await backend
      .collection("chat_threads")
      .where("user_id", "==", userId)
      .orderBy("created_at", "asc")
      .limit(1)
      .get()
    if (snapshot.empty) return null
    return snapshot.docs[0]?.id ?? null
  }

  const { data, error } = await backend
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
export async function getPrimaryThreadIdForUser(backend: ChatStoreBackend, userId: string): Promise<string> {
  const existingId = await getOldestThreadIdForUser(backend, userId)
  if (existingId) return existingId

  if (isFirestoreBackend(backend)) {
    const threadId = newDocumentId()
    const createdAt = nowIso()
    await backend
      .collection("chat_threads")
      .doc(threadId)
      .set(
        toFirestorePayload({
          id: threadId,
          user_id: userId,
          title: "Sigma conversation",
          created_at: createdAt,
          updated_at: createdAt,
          memory_enabled: false,
          memory_profile: {},
          memory_profile_updated_at: null,
          release_ring: "full",
          project_id: null,
        }),
      )
    return threadId
  }

  const { data: createdThread, error: createError } = await backend
    .from("chat_threads")
    .insert({ user_id: userId, title: "Sigma conversation" })
    .select("id")
    .single()

  if (createError) throw createError
  return createdThread.id as string
}

export async function persistChatExchange(
  backend: ChatStoreBackend,
  userId: string,
  userMessage: string,
  assistantResponse: ChatAssistantResponse,
  threadId?: string,
) {
  let resolvedThreadId: string
  if (threadId !== undefined && threadId !== "") {
    const allowed = await verifyThreadBelongsToUser(backend, userId, threadId)
    if (!allowed) {
      throw new Error("Chat thread not found or access denied")
    }
    resolvedThreadId = threadId
  } else {
    resolvedThreadId = await getPrimaryThreadIdForUser(backend, userId)
  }

  if (isFirestoreBackend(backend)) {
    const userMessageId = newDocumentId()
    const assistantMessageId = newDocumentId()
    const firstCreatedAt = nowIso()
    const secondCreatedAt = nowIso()
    const batch = backend.batch()
    const messages = backend.collection("chat_messages")
    batch.set(
      messages.doc(userMessageId),
      toFirestorePayload({
        id: userMessageId,
        thread_id: resolvedThreadId,
        user_id: userId,
        role: "user",
        content: userMessage,
        metadata: {},
        created_at: firstCreatedAt,
      }),
    )
    batch.set(
      messages.doc(assistantMessageId),
      toFirestorePayload({
        id: assistantMessageId,
        thread_id: resolvedThreadId,
        user_id: userId,
        role: "assistant",
        content: assistantResponse.answer,
        metadata: assistantMetadataFromResponse(assistantResponse),
        created_at: secondCreatedAt,
      }),
    )
    batch.set(
      backend.collection("chat_threads").doc(resolvedThreadId),
      toFirestorePayload({ updated_at: secondCreatedAt }),
      { merge: true },
    )
    await batch.commit()
    return
  }

  const { error: insertError } = await backend.from("chat_messages").insert([
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
  backend: ChatStoreBackend,
  userId: string,
  threadId: string,
  limit = 60,
): Promise<StoredChatMessage[]> {
  const allowed = await verifyThreadBelongsToUser(backend, userId, threadId)
  if (!allowed) {
    throw new Error("Chat thread not found or access denied")
  }

  if (isFirestoreBackend(backend)) {
    const snapshot = await backend
      .collection("chat_messages")
      .where("thread_id", "==", threadId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .get()
    const rows = snapshot.docs
      .map((doc) => {
        const data = (doc.data() ?? {}) as Record<string, unknown>
        return {
          id: doc.id,
          role: data.role === "assistant" ? "assistant" : "user",
          content: typeof data.content === "string" ? data.content : "",
          metadata: isRecord(data.metadata) ? data.metadata : {},
          created_at: typeof data.created_at === "string" ? data.created_at : nowIso(),
        } satisfies PersistedRow
      })
      .reverse()
    return rows.map(mapStoredMessage)
  }

  const { data, error } = await backend
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
  backend: ChatStoreBackend,
  userId: string,
  limit = 60,
): Promise<StoredChatMessage[]> {
  const threadId = await getOldestThreadIdForUser(backend, userId)
  if (!threadId) return []
  return loadChatHistoryForThread(backend, userId, threadId, limit)
}

export async function clearChatHistoryForThread(backend: ChatStoreBackend, userId: string, threadId: string) {
  const allowed = await verifyThreadBelongsToUser(backend, userId, threadId)
  if (!allowed) {
    throw new Error("Chat thread not found or access denied")
  }

  if (isFirestoreBackend(backend)) {
    while (true) {
      const snapshot = await backend
        .collection("chat_messages")
        .where("thread_id", "==", threadId)
        .limit(300)
        .get()
      if (snapshot.empty) break
      const batch = backend.batch()
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref)
      }
      await batch.commit()
    }
    await touchThreadUpdatedAt(backend, threadId, userId)
    return
  }

  const { error } = await backend.from("chat_messages").delete().eq("thread_id", threadId)
  if (error) throw error
}

/** Clears messages on the primary (oldest) thread only; does not create a thread. */
export async function clearUserChatHistory(backend: ChatStoreBackend, userId: string) {
  const threadId = await getOldestThreadIdForUser(backend, userId)
  if (!threadId) return
  await clearChatHistoryForThread(backend, userId, threadId)
}

/** Memory profile is stored on the primary (oldest) thread only; Sigma full-page secondary threads do not carry it. */
export async function getUserSigmaMemoryProfile(
  backend: ChatStoreBackend,
  userId: string,
): Promise<SigmaMemoryProfile> {
  const threadId = await getPrimaryThreadIdForUser(backend, userId)

  if (isFirestoreBackend(backend)) {
    const snapshot = await backend.collection("chat_threads").doc(threadId).get()
    const data = (snapshot.data() ?? {}) as Record<string, unknown>
    return sanitizeMemoryProfile({
      enabled: data.memory_enabled === true,
      profile: isRecord(data.memory_profile) ? data.memory_profile : {},
      updatedAt: typeof data.memory_profile_updated_at === "string" ? data.memory_profile_updated_at : undefined,
    })
  }

  const { data, error } = await backend
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
  backend: ChatStoreBackend,
  userId: string,
  input: SigmaMemoryProfile,
): Promise<SigmaMemoryProfile> {
  const threadId = await getPrimaryThreadIdForUser(backend, userId)
  const sanitized = sanitizeMemoryProfile(input)
  const nowIso = new Date().toISOString()

  if (isFirestoreBackend(backend)) {
    await backend
      .collection("chat_threads")
      .doc(threadId)
      .set(
        toFirestorePayload({
          memory_enabled: sanitized.enabled,
          memory_profile: sanitized.profile,
          memory_profile_updated_at: nowIso,
          updated_at: nowIso,
        }),
        { merge: true },
      )
  } else {
    const { error } = await backend
      .from("chat_threads")
      .update({
        memory_enabled: sanitized.enabled,
        memory_profile: sanitized.profile,
        memory_profile_updated_at: nowIso,
      })
      .eq("id", threadId)

    if (error) throw error
  }

  return {
    ...sanitized,
    updatedAt: nowIso,
  }
}

export async function resetUserSigmaMemoryProfile(
  backend: ChatStoreBackend,
  userId: string,
): Promise<SigmaMemoryProfile> {
  const threadId = await getPrimaryThreadIdForUser(backend, userId)
  const updatedAt = nowIso()

  if (isFirestoreBackend(backend)) {
    await backend
      .collection("chat_threads")
      .doc(threadId)
      .set(
        toFirestorePayload({
          memory_enabled: false,
          memory_profile: {},
          memory_profile_updated_at: updatedAt,
          updated_at: updatedAt,
        }),
        { merge: true },
      )
  } else {
    const { error } = await backend
      .from("chat_threads")
      .update({
        memory_enabled: false,
        memory_profile: {},
        memory_profile_updated_at: updatedAt,
      })
      .eq("id", threadId)

    if (error) throw error
  }
  return { ...DEFAULT_SIGMA_MEMORY_PROFILE, updatedAt }
}

export async function syncUserReleaseRing(
  backend: ChatStoreBackend,
  userId: string,
  ring: "internal" | "beta" | "full",
) {
  const threadId = await getPrimaryThreadIdForUser(backend, userId)
  if (isFirestoreBackend(backend)) {
    await backend
      .collection("chat_threads")
      .doc(threadId)
      .set(toFirestorePayload({ release_ring: ring, updated_at: nowIso() }), { merge: true })
    return
  }

  const { error } = await backend.from("chat_threads").update({ release_ring: ring }).eq("id", threadId)
  if (error) throw error
}
