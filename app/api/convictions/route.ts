import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { createRepositories } from "@/lib/data/repositories"
import { createClient } from "@/lib/supabase/server"
import { isFirebaseBackend } from "@/lib/data/backend"

export async function GET() {
  try {
    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = isFirebaseBackend() ? null : await createClient()
    const repositories = createRepositories({ supabase: supabase ?? undefined })

    const [theses, events, statusChangeNotes] = await Promise.all([
      repositories.theses.listDashboardByUserId(userId),
      repositories.events.listUnreviewedByUserId(userId),
      repositories.thesisUpdates.listStatusChangeNotesByUserId(userId),
    ])

    const latestNoteByThesis = new Map<string, { note: string; status: string }>()
    for (const update of statusChangeNotes) {
      if (!latestNoteByThesis.has(update.thesis_id) && update.note && update.new_status) {
        latestNoteByThesis.set(update.thesis_id, {
          note: update.note,
          status: update.new_status,
        })
      }
    }

    return NextResponse.json({
      theses: theses.map((thesis) => ({
        ...thesis,
        latest_status_note: latestNoteByThesis.get(thesis.id)?.note ?? null,
        latest_status_note_status: latestNoteByThesis.get(thesis.id)?.status ?? null,
      })),
      challengeEvents: events.map((event) => ({
        id: event.id,
        thesisId: event.thesis_id,
        eventDetail: event.event_detail ?? "",
        createdAt: event.created_at ?? null,
      })),
    })
  } catch (error) {
    console.error("Convictions load failed:", error)
    return NextResponse.json({ error: "Failed to load convictions" }, { status: 500 })
  }
}
