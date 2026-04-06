import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const MAX_NAME_LEN = 200

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const t = raw.trim()
  if (!t || t.length > MAX_NAME_LEN) return null
  return t
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 })
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

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("sigma_projects")
      .update({ name })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, name, updated_at, created_at")
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({ project: data })
  } catch (error) {
    console.error("Patch sigma project failed:", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("sigma_projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")

    if (error) {
      throw error
    }

    if (!data?.length) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete sigma project failed:", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
