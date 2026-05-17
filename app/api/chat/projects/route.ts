import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
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
    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isFirebaseBackend()) {
      const snapshot = await getFirebaseAdminFirestore()
        .collection("sigma_projects")
        .where("user_id", "==", userId)
        .orderBy("updated_at", "desc")
        .get()
      const projects = snapshot.docs.map((doc) => {
        const row = (doc.data() ?? {}) as Record<string, unknown>
        return {
          id: doc.id,
          name: typeof row.name === "string" ? row.name : "",
          updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
          created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
        }
      })
      return NextResponse.json({ projects })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("sigma_projects")
      .select("id, name, updated_at, created_at")
      .eq("user_id", userId)
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
    const userId = await getServerUserId()
    if (!userId) {
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

    if (isFirebaseBackend()) {
      const now = new Date().toISOString()
      const projectId = crypto.randomUUID()
      const project = {
        id: projectId,
        user_id: userId,
        name,
        created_at: now,
        updated_at: now,
      }
      await getFirebaseAdminFirestore().collection("sigma_projects").doc(projectId).set(project)
      return NextResponse.json({
        project: { id: projectId, name, updated_at: now, created_at: now },
      })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("sigma_projects")
      .insert({ user_id: userId, name })
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
