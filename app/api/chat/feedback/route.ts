import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type FeedbackType = "thumbs_up" | "thumbs_down" | "handoff_requested"

type FeedbackBody = {
  feedbackType?: FeedbackType
  messageId?: string
  currentPath?: string
}

const ALLOWED_FEEDBACK: FeedbackType[] = ["thumbs_up", "thumbs_down", "handoff_requested"]

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeedbackBody
    const feedbackType = body.feedbackType

    if (!feedbackType || !ALLOWED_FEEDBACK.includes(feedbackType)) {
      return NextResponse.json({ error: "Invalid feedbackType" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.info(
      JSON.stringify({
        event: "chat_feedback",
        userId: user.id,
        feedbackType,
        messageId: body.messageId ?? null,
        currentPath: body.currentPath ?? null,
      }),
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
