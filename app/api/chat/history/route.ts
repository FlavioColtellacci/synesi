import { NextResponse } from "next/server"
import {
  clearChatHistoryForThread,
  clearUserChatHistory,
  loadChatHistoryForThread,
  loadUserChatHistory,
  resolveOptionalThreadIdForUser,
} from "@/lib/chat/store"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const threadParam = new URL(request.url).searchParams.get("threadId")
    const resolved = await resolveOptionalThreadIdForUser(supabase, user.id, threadParam)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    const messages = resolved.threadId
      ? await loadChatHistoryForThread(supabase, user.id, resolved.threadId)
      : await loadUserChatHistory(supabase, user.id)
    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ error: "Failed to load chat history" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const threadParam = new URL(request.url).searchParams.get("threadId")
    const resolved = await resolveOptionalThreadIdForUser(supabase, user.id, threadParam)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }

    if (resolved.threadId) {
      await clearChatHistoryForThread(supabase, user.id, resolved.threadId)
    } else {
      await clearUserChatHistory(supabase, user.id)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to clear chat history" }, { status: 500 })
  }
}
