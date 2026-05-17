import { notFound, redirect } from "next/navigation"
import SigmaWorkspace from "@/components/sigma/SigmaWorkspace"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import { createClient } from "@/lib/supabase/server"

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

type SigmaThreadPageProps = {
  params: Promise<{ threadId: string }>
}

export default async function SigmaThreadPage({ params }: SigmaThreadPageProps) {
  const { threadId } = await params

  if (!UUID_RE.test(threadId)) {
    notFound()
  }

  const userId = await getServerUserId()
  if (!userId) {
    redirect("/login")
  }

  if (isFirebaseBackend()) {
    const snapshot = await getFirebaseAdminFirestore().collection("chat_threads").doc(threadId).get()
    if (!snapshot.exists) {
      notFound()
    }
    const data = (snapshot.data() ?? {}) as Record<string, unknown>
    if (typeof data.user_id !== "string" || data.user_id !== userId) {
      notFound()
    }
  } else {
    const supabase = await createClient()
    const { data: row } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("id", threadId)
      .eq("user_id", userId)
      .maybeSingle()

    if (!row) {
      notFound()
    }
  }

  return <SigmaWorkspace threadId={threadId} />
}
