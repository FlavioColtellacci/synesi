import { NextResponse } from "next/server"
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

    const { data, error } = await supabase
      .from("chat_threads")
      .select("id, title, updated_at, created_at, project_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ threads: data ?? [] })
  } catch {
    return NextResponse.json({ error: "Failed to list threads" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: user.id, title: "Sigma conversation" })
      .select("id, title, updated_at")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ thread: data })
  } catch {
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 })
  }
}
