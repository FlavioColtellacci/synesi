import { NextResponse } from "next/server"
import { clearUserChatHistory, loadUserChatHistory } from "@/lib/chat/store"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const messages = await loadUserChatHistory(supabase, user.id)
    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ error: "Failed to load chat history" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await clearUserChatHistory(supabase, user.id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Failed to clear chat history" }, { status: 500 })
  }
}
