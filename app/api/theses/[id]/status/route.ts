import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const VALID_STATUSES = ["intact", "at_risk", "broken"] as const
type ThesisStatus = (typeof VALID_STATUSES)[number]

function isValidStatus(value: unknown): value is ThesisStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as ThesisStatus)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: thesisId } = await params

    const body = (await request.json()) as { status?: unknown; note?: unknown }

    if (!isValidStatus(body.status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be intact, at_risk, or broken." },
        { status: 400 },
      )
    }

    const newStatus = body.status
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: thesis, error: fetchError } = await supabase
      .from("theses")
      .select("id, status, user_id")
      .eq("id", thesisId)
      .single()

    if (fetchError || !thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    if (thesis.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const oldStatus = thesis.status

    const { error: updateError } = await supabase
      .from("theses")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", thesisId)

    if (updateError) {
      throw updateError
    }

    const { error: insertError } = await supabase.from("thesis_updates").insert({
      thesis_id: thesisId,
      user_id: user.id,
      update_type: "status_change",
      old_status: oldStatus,
      new_status: newStatus,
      note,
    })

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error) {
    console.error("Status update failed:", error)
    return NextResponse.json({ error: "Status update failed" }, { status: 500 })
  }
}
