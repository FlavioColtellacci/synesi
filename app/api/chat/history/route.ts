import { NextResponse } from "next/server"
import {
  clearChatHistoryForThread,
  clearUserChatHistory,
  loadChatHistoryForThread,
  loadUserChatHistory,
  resolveOptionalThreadIdForUser,
} from "@/lib/chat/store"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const backend = isFirebaseBackend() ? getFirebaseAdminFirestore() : await createClient()

    const threadParam = new URL(request.url).searchParams.get("threadId")
    const resolved = await resolveOptionalThreadIdForUser(backend, userId, threadParam)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const messages = resolved.threadId
      ? await loadChatHistoryForThread(backend, userId, resolved.threadId)
      : await loadUserChatHistory(backend, userId)
    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ error: "Failed to load chat history" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const backend = isFirebaseBackend() ? getFirebaseAdminFirestore() : await createClient()

    const threadParam = new URL(request.url).searchParams.get("threadId")
    const resolved = await resolveOptionalThreadIdForUser(backend, userId, threadParam)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    if (resolved.threadId) {
      await clearChatHistoryForThread(backend, userId, resolved.threadId)
    } else {
      await clearUserChatHistory(backend, userId)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to clear chat history" }, { status: 500 })
  }
}
