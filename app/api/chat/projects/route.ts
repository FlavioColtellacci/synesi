import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const MAX_NAME_LEN = 200

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const t = raw.trim()
  if (!t || t.length > MAX_NAME_LEN) return null
  return t
}

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
      .from("sigma_projects")
      .select("id, name, updated_at, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ projects: data ?? [] })
  } catch {
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: { name?: unknown }
    try {
      body = (await request.json()) as { name?: unknown }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const name = normalizeName(body.name)
    if (!name) {
      return NextResponse.json({ error: "name is required (non-empty string)" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("sigma_projects")
      .insert({ user_id: user.id, name })
      .select("id, name, updated_at, created_at")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ project: data })
  } catch {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
