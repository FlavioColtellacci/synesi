import type { ChatAssistantResponse } from "@/lib/chat/types"
import type { SupabaseClient } from "@supabase/supabase-js"

type PersistedRole = "user" | "assistant"

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
  webContextVerified?: boolean
}

function assistantMetadataFromResponse(response: ChatAssistantResponse): Record<string, unknown> {
  return {
    sourceTags: response.sourceTags,
    confidence: response.confidence,
    escalation: response.escalation,
    followUpActions: response.followUpActions,
    webContextVerified: response.webContextVerified ?? false,
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
    webContextVerified: metadata.webContextVerified === true,
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
