import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function SigmaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: rows, error: listError } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)

  if (listError) {
    redirect("/app/dashboard")
  }

  const latestId = rows?.[0]?.id
  if (latestId) {
    redirect(`/app/sigma/c/${latestId}`)
  }

  const { data: created, error: createError } = await supabase
    .from("chat_threads")
    .insert({ user_id: user.id, title: "Sigma conversation" })
    .select("id")
    .single()

  if (createError || !created?.id) {
    redirect("/app/dashboard")
  }

  redirect(`/app/sigma/c/${created.id}`)
}
