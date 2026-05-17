import { redirect } from "next/navigation"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import { createClient } from "@/lib/supabase/server"

export default async function SigmaPage() {
  const userId = await getServerUserId()
  if (!userId) {
    redirect("/login")
  }

  if (isFirebaseBackend()) {
    const firestore = getFirebaseAdminFirestore()
    const latestSnapshot = await firestore
      .collection("chat_threads")
      .where("user_id", "==", userId)
      .orderBy("updated_at", "desc")
      .limit(1)
      .get()

    const latestDoc = latestSnapshot.docs[0]
    if (latestDoc?.id) {
      redirect(`/app/sigma/c/${latestDoc.id}`)
    }

    const now = new Date().toISOString()
    const threadId = crypto.randomUUID()
    await firestore.collection("chat_threads").doc(threadId).set({
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
    })
    redirect(`/app/sigma/c/${threadId}`)
  }

  const supabase = await createClient()
  const { data: rows, error: listError } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)

  if (listError) {
    redirect("/app/convictions")
  }

  const latestId = rows?.[0]?.id
  if (latestId) {
    redirect(`/app/sigma/c/${latestId}`)
  }

  const { data: created, error: createError } = await supabase
    .from("chat_threads")
    .insert({ user_id: userId, title: "Sigma conversation" })
    .select("id")
    .single()

  if (createError || !created?.id) {
    redirect("/app/convictions")
  }

  redirect(`/app/sigma/c/${created.id}`)
}
