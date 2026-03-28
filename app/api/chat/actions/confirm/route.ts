import { NextResponse } from "next/server"
import { resolveConfirmedAction, type SigmaActionDraft } from "@/lib/chat/actions"
import { createClient } from "@/lib/supabase/server"

type ConfirmActionBody = {
  confirmed?: boolean
  action?: SigmaActionDraft
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as ConfirmActionBody
  if (body.confirmed !== true || !body.action) {
    return NextResponse.json({ error: "Confirmation and action payload are required" }, { status: 400 })
  }

  const execution = await resolveConfirmedAction(supabase, user.id, body.action)
  if (!execution) {
    return NextResponse.json({ error: "Action is not allowed or not resolvable" }, { status: 400 })
  }

  return NextResponse.json({
    execution,
    message:
      execution.status === "ready"
        ? "Action confirmed. You can proceed."
        : "Action draft is prepared. Final edits are still required before saving changes.",
  })
}
