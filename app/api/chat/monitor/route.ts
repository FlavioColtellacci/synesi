import { NextResponse } from "next/server"
import { getSigmaMonitorDailyRunKey } from "@/lib/chat/monitor-logic"
import { getLatestSigmaMonitorRun, runSigmaMonitorForUser } from "@/lib/chat/monitor"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const userId = await getServerUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const backend = isFirebaseBackend() ? getFirebaseAdminFirestore() : await createClient()
  const latest = await getLatestSigmaMonitorRun(backend, userId)
  return NextResponse.json({ monitor: latest })
}

export async function POST(request: Request) {
  const userId = await getServerUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const backend = isFirebaseBackend() ? getFirebaseAdminFirestore() : await createClient()
  const body = (await request.json().catch(() => ({}))) as { force?: boolean }
  const force = body.force === true
  const runKey = getSigmaMonitorDailyRunKey()

  const result = await runSigmaMonitorForUser(backend, {
    userId,
    runKey,
    triggerSource: "manual",
    force,
  })

  return NextResponse.json({
    monitor: result.snapshot,
    createdNewRun: result.createdNewRun,
  })
}
