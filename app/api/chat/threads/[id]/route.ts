import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type PatchThreadBody = {
  projectId?: string | null
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid thread id" }, { status: 400 })
    }

    let body: PatchThreadBody
    try {
      body = (await request.json()) as PatchThreadBody
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (!("projectId" in body)) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    const { projectId } = body

    if (projectId !== null && projectId !== undefined && typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId must be a string UUID or null" }, { status: 400 })
    }

    if (typeof projectId === "string" && !UUID_RE.test(projectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (typeof projectId === "string") {
      const { data: project, error: projectError } = await supabase
        .from("sigma_projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (projectError) {
        throw projectError
      }
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
    }

    const { data, error } = await supabase
      .from("chat_threads")
      .update({ project_id: projectId })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, title, updated_at, project_id")
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    return NextResponse.json({ thread: data })
  } catch (error) {
    console.error("Patch chat thread failed:", error)
    return NextResponse.json({ error: "Failed to update thread" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid thread id" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("chat_threads")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")

    if (error) {
      throw error
    }

    if (!data?.length) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Delete chat thread failed:", error)
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 })
  }
}
