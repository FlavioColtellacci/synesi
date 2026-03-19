import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type ThesisOwnership = Pick<
  Database["public"]["Tables"]["theses"]["Row"],
  "id" | "user_id"
>

type DeleteRouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function DELETE(_request: Request, { params }: DeleteRouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: thesis, error: fetchError } = await supabase
      .from("theses")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle<ThesisOwnership>()

    if (fetchError) {
      throw fetchError
    }

    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    if (thesis.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error: deleteError } = await supabase.from("theses").delete().eq("id", id)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete thesis failed:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
