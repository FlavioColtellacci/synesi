import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import { deleteOwnedTrustedSource as deleteFirebaseTrustedSource } from "@/lib/firebase/alerting"
import { createClient } from "@/lib/supabase/server"

type DeleteRouteContext = {
  params: Promise<{
    id: string
    sourceId: string
  }>
}

export async function DELETE(_request: Request, { params }: DeleteRouteContext) {
  try {
    const { id: thesisId, sourceId } = await params
    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isFirebaseBackend()) {
      const firestore = getFirebaseAdminFirestore()
      const deleted = await deleteFirebaseTrustedSource(firestore, userId, thesisId, sourceId)
      if (!deleted) {
        return NextResponse.json({ error: "Trusted source not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    }

    const supabase = await createClient()

    const { data: deleted, error: deleteError } = await supabase
      .from("trusted_sources")
      .delete()
      .eq("id", sourceId)
      .eq("thesis_id", thesisId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle()

    if (deleteError) {
      throw deleteError
    }

    if (!deleted) {
      return NextResponse.json({ error: "Trusted source not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete trusted source failed:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
