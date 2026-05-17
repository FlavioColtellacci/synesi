import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { createRepositories } from "@/lib/data/repositories"
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

    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = isFirebaseBackend() ? null : await createClient()
    const repositories = createRepositories({ supabase: supabase ?? undefined })

    const oldStatus = await repositories.theses.updateStatus(userId, thesisId, newStatus)
    if (!oldStatus) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    await repositories.thesisUpdates.insert({
      thesis_id: thesisId,
      user_id: userId,
      update_type: "status_change",
      old_status: oldStatus,
      new_status: newStatus,
      note,
    })

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error) {
    console.error("Status update failed:", error)
    return NextResponse.json({ error: "Status update failed" }, { status: 500 })
  }
}
