import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isFirebaseBackend()) {
      const snapshot = await getFirebaseAdminFirestore()
        .collection("chat_threads")
        .where("user_id", "==", userId)
        .orderBy("updated_at", "desc")
        .get()
      const threads = snapshot.docs.map((doc) => {
        const row = (doc.data() ?? {}) as Record<string, unknown>
        return {
          id: doc.id,
          title: typeof row.title === "string" ? row.title : "Sigma conversation",
          updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
          created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
          project_id: typeof row.project_id === "string" ? row.project_id : null,
        }
      })
      return NextResponse.json({ threads })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("chat_threads")
      .select("id, title, updated_at, created_at, project_id")
      .eq("user_id", userId)
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
    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isFirebaseBackend()) {
      const now = new Date().toISOString()
      const threadId = crypto.randomUUID()
      const thread = {
        id: threadId,
        user_id: userId,
        title: "Sigma conversation",
        created_at: now,
        updated_at: now,
        memory_enabled: false,
        memory_profile: {},
        memory_profile_updated_at: null,
        release_ring: "full",
        project_id: null,
      }
      await getFirebaseAdminFirestore().collection("chat_threads").doc(threadId).set(thread)
      return NextResponse.json({
        thread: { id: threadId, title: thread.title, updated_at: now, created_at: now, project_id: null },
      })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("chat_threads")
      .insert({ user_id: userId, title: "Sigma conversation" })
      .select("id, title, updated_at, created_at, project_id")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ thread: data })
  } catch {
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 })
  }
}
