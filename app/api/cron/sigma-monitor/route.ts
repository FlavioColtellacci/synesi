import { NextResponse } from "next/server"
import { getSigmaMonitorDailyRunKey } from "@/lib/chat/monitor-logic"
import { runSigmaMonitorForUser } from "@/lib/chat/monitor"
import { createAdminClient } from "@/lib/supabase/server"

type UserRow = { user_id: string }

function getMaxUsersPerRun() {
  const parsed = Number.parseInt(process.env.CRON_SIGMA_MONITOR_MAX_USERS_PER_RUN ?? "", 10)
  if (Number.isNaN(parsed) || parsed <= 0) return 25
  return parsed
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const maxUsers = getMaxUsersPerRun()

  const { data, error } = await supabase
    .from("theses")
    .select("user_id")
    .order("updated_at", { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const uniqueUsers = Array.from(new Set(((data ?? []) as UserRow[]).map((row) => row.user_id))).slice(0, maxUsers)
  const runKey = getSigmaMonitorDailyRunKey()

  let successCount = 0
  let failedCount = 0
  const errors: Array<{ userId: string; error: string }> = []

  for (const userId of uniqueUsers) {
    try {
      const result = await runSigmaMonitorForUser(supabase, {
        userId,
        runKey,
        triggerSource: "cron",
      })
      if (result.snapshot.status === "success") {
        successCount += 1
      } else {
        failedCount += 1
      }
    } catch (runError) {
      failedCount += 1
      errors.push({
        userId,
        error: runError instanceof Error ? runError.message : "Unknown error",
      })
    }
  }

  return NextResponse.json({
    runKey,
    processedUsers: uniqueUsers.length,
    successCount,
    failedCount,
    limitedByMaxUsers: uniqueUsers.length >= maxUsers,
    maxUsersPerRun: maxUsers,
    errors,
  })
}
