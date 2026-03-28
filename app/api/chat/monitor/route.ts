import { NextResponse } from "next/server"
import { getSigmaMonitorDailyRunKey } from "@/lib/chat/monitor-logic"
import { getLatestSigmaMonitorRun, runSigmaMonitorForUser } from "@/lib/chat/monitor"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const latest = await getLatestSigmaMonitorRun(supabase, user.id)
  return NextResponse.json({ monitor: latest })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { force?: boolean }
  const force = body.force === true
  const runKey = getSigmaMonitorDailyRunKey()

  const result = await runSigmaMonitorForUser(supabase, {
    userId: user.id,
    runKey,
    triggerSource: "manual",
    force,
  })

  return NextResponse.json({
    monitor: result.snapshot,
    createdNewRun: result.createdNewRun,
  })
}
