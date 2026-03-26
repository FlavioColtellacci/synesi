import { NextResponse } from "next/server"
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
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("trusted_sources")
      .delete()
      .eq("id", sourceId)
      .eq("thesis_id", thesisId)
      .eq("user_id", user.id)
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
