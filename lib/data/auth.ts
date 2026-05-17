import { isFirebaseBackend } from "@/lib/data/backend"
import { verifyFirebaseSessionCookie } from "@/lib/firebase/session"
import { createClient } from "@/lib/supabase/server"

export async function getServerUserId(): Promise<string | null> {
  if (isFirebaseBackend()) {
    const token = await verifyFirebaseSessionCookie()
    return token?.uid ?? null
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}
