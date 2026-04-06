import { notFound, redirect } from "next/navigation"
import SigmaWorkspace from "@/components/sigma/SigmaWorkspace"
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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: row } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("id", threadId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!row) {
    notFound()
  }

  return <SigmaWorkspace threadId={threadId} />
}
