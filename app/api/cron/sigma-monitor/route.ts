import { NextResponse } from "next/server"
import { getSigmaMonitorDailyRunKey } from "@/lib/chat/monitor-logic"
import { runSigmaMonitorForUser } from "@/lib/chat/monitor"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import { createAdminClient } from "@/lib/supabase/server"

export const maxDuration = 300

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

  const maxUsers = getMaxUsersPerRun()
  let uniqueUsers: string[]
  let backend: ReturnType<typeof getFirebaseAdminFirestore> | ReturnType<typeof createAdminClient>
  if (isFirebaseBackend()) {
    const firestore = getFirebaseAdminFirestore()
    backend = firestore
    const theses = await firestore.collection("theses").orderBy("updated_at", "desc").limit(500).get()
    uniqueUsers = Array.from(
      new Set(
        theses.docs
          .map((doc) => {
            const data = (doc.data() ?? {}) as Record<string, unknown>
            return typeof data.user_id === "string" ? data.user_id : ""
          })
          .filter(Boolean),
      ),
    ).slice(0, maxUsers)
  } else {
    const supabase = createAdminClient()
    backend = supabase
    const { data, error } = await supabase
      .from("theses")
      .select("user_id")
      .order("updated_at", { ascending: false })
      .limit(500)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    uniqueUsers = Array.from(
      new Set(
        (data ?? [])
          .map((row) => (typeof row.user_id === "string" ? row.user_id : ""))
          .filter(Boolean),
      ),
    ).slice(0, maxUsers)
  }
  const runKey = getSigmaMonitorDailyRunKey()

  let successCount = 0
  let failedCount = 0
  const errors: Array<{ userId: string; error: string }> = []

  for (const userId of uniqueUsers) {
    try {
      const result = await runSigmaMonitorForUser(backend, {
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
