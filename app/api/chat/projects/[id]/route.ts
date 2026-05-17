import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
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

    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isFirebaseBackend()) {
      const firestore = getFirebaseAdminFirestore()
      const projectRef = firestore.collection("sigma_projects").doc(id)
      const projectSnapshot = await projectRef.get()
      if (!projectSnapshot.exists) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      const existing = (projectSnapshot.data() ?? {}) as Record<string, unknown>
      if (existing.user_id !== userId) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }

      const updatedAt = new Date().toISOString()
      await projectRef.set({ name, updated_at: updatedAt }, { merge: true })
      const next = (await projectRef.get()).data() as Record<string, unknown> | undefined
      return NextResponse.json({
        project: {
          id,
          name: typeof next?.name === "string" ? next.name : name,
          updated_at: typeof next?.updated_at === "string" ? next.updated_at : updatedAt,
          created_at: typeof next?.created_at === "string" ? next.created_at : updatedAt,
        },
      })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("sigma_projects")
      .update({ name })
      .eq("id", id)
      .eq("user_id", userId)
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

    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isFirebaseBackend()) {
      const firestore = getFirebaseAdminFirestore()
      const projectRef = firestore.collection("sigma_projects").doc(id)
      const projectSnapshot = await projectRef.get()
      if (!projectSnapshot.exists) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      const existing = (projectSnapshot.data() ?? {}) as Record<string, unknown>
      if (existing.user_id !== userId) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }

      const threads = await firestore
        .collection("chat_threads")
        .where("project_id", "==", id)
        .where("user_id", "==", userId)
        .get()
      if (!threads.empty) {
        const batch = firestore.batch()
        for (const doc of threads.docs) {
          batch.set(doc.ref, { project_id: null, updated_at: new Date().toISOString() }, { merge: true })
        }
        await batch.commit()
      }

      await projectRef.delete()
      return NextResponse.json({ ok: true })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("sigma_projects")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
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
