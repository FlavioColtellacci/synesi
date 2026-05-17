import { NextResponse } from "next/server"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import { verifyFirebaseSessionCookie } from "@/lib/firebase/session"
import { createClient } from "@/lib/supabase/server"
import { refreshFinancialSnapshot } from "@/lib/financial/refresh"

type RefreshBody = {
  ticker?: string
  source?: "provider" | "web"
}

type ThesisLookupRow = {
  id: string
}

function getUserDailyRefreshLimit(): number {
  const parsed = Number.parseInt(process.env.FINANCIAL_REFRESH_DAILY_LIMIT_PER_USER ?? "", 10)
  if (Number.isNaN(parsed) || parsed <= 0) return 3
  return parsed
}

function getStartOfUtcDayIso() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

function hasInternalAccess(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!authHeader || !cronSecret) return false
  return authHeader === `Bearer ${cronSecret}`
}

export async function POST(request: Request) {
  try {
    let body: RefreshBody
    try {
      body = (await request.json()) as RefreshBody
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
    }
    const ticker = body.ticker?.trim().toUpperCase()
    const source = body.source === "web" ? "web" : "provider"

    if (!ticker) {
      return NextResponse.json({ error: "Ticker is required" }, { status: 400 })
    }

    const firebaseMode = isFirebaseBackend()
    let supabaseForUser: Awaited<ReturnType<typeof createClient>> | null = null
    let userIdForLog: string | null = null
    let thesisIdForLog: string | null = null
    let dailyLimitForUser: number | null = null
    let usedTodayBeforeCall = 0

    // Allow either internal cron-style auth or logged-in app users.
    if (!hasInternalAccess(request)) {
      const limit = getUserDailyRefreshLimit()
      const dayStartIso = getStartOfUtcDayIso()

      if (firebaseMode) {
        const token = await verifyFirebaseSessionCookie()
        const userId = token?.uid ?? null
        if (!userId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const firestore = getFirebaseAdminFirestore()
        const [dailyCountSnapshot, ownedThesisSnapshot] = await Promise.all([
          firestore
            .collection("thesis_updates")
            .where("user_id", "==", userId)
            .where("update_type", "==", "financial_refresh")
            .where("created_at", ">=", dayStartIso)
            .count()
            .get(),
          firestore
            .collection("theses")
            .where("user_id", "==", userId)
            .where("ticker", "==", ticker)
            .limit(1)
            .get(),
        ])

        const usedToday = dailyCountSnapshot.data().count
        usedTodayBeforeCall = usedToday
        dailyLimitForUser = limit
        if (usedToday >= limit) {
          return NextResponse.json(
            {
              ok: false,
              error: `Daily refresh limit reached (${limit}/${limit}). Try again tomorrow.`,
            },
            { status: 429 },
          )
        }

        if (ownedThesisSnapshot.empty) {
          return NextResponse.json(
            { ok: false, error: "Ticker must belong to one of your theses" },
            { status: 403 },
          )
        }

        thesisIdForLog = ownedThesisSnapshot.docs[0]?.id ?? null
        userIdForLog = userId
      } else {
        const supabase = await createClient()
        supabaseForUser = supabase
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { count, error: countError } = await supabase
          .from("thesis_updates")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("update_type", "financial_refresh")
          .gte("created_at", dayStartIso)

        if (countError) {
          return NextResponse.json({ error: countError.message }, { status: 500 })
        }

        const usedToday = count ?? 0
        usedTodayBeforeCall = usedToday
        dailyLimitForUser = limit
        if (usedToday >= limit) {
          return NextResponse.json(
            {
              ok: false,
              error: `Daily refresh limit reached (${limit}/${limit}). Try again tomorrow.`,
            },
            { status: 429 },
          )
        }

        const { data: ownedThesis, error: thesisLookupError } = await supabase
          .from("theses")
          .select("id")
          .eq("user_id", user.id)
          .eq("ticker", ticker)
          .limit(1)
          .maybeSingle()

        if (thesisLookupError) {
          return NextResponse.json({ error: thesisLookupError.message }, { status: 500 })
        }

        if (!ownedThesis) {
          return NextResponse.json(
            { ok: false, error: "Ticker must belong to one of your theses" },
            { status: 403 },
          )
        }

        const thesis = ownedThesis as ThesisLookupRow
        thesisIdForLog = thesis.id
        userIdForLog = user.id
      }
    }

    const result = await refreshFinancialSnapshot({ ticker, source })

    const logCtx = { ticker, source, userId: userIdForLog ?? "internal" }
    if (!result.ok) {
      console.log("[financial/refresh] FAILED", { ...logCtx, error: result.error })
      return NextResponse.json(
        { ok: false, ticker: result.ticker, error: result.error },
        { status: 502 },
      )
    }
    console.log("[financial/refresh] OK", { ...logCtx, staleAfter: result.staleAfter })

    if (userIdForLog && thesisIdForLog) {
      if (firebaseMode) {
        const firestore = getFirebaseAdminFirestore()
        const updateId = crypto.randomUUID()
        await firestore.collection("thesis_updates").doc(updateId).set({
          id: updateId,
          thesis_id: thesisIdForLog,
          user_id: userIdForLog,
          update_type: "financial_refresh",
          note: `Manual ${source === "web" ? "web" : "provider"} financial refresh for ${ticker}`,
          created_at: new Date().toISOString(),
        })
      } else if (supabaseForUser) {
        await supabaseForUser.from("thesis_updates").insert({
          thesis_id: thesisIdForLog,
          user_id: userIdForLog,
          update_type: "financial_refresh",
          note: `Manual ${source === "web" ? "web" : "provider"} financial refresh for ${ticker}`,
        })
      }
    }

    return NextResponse.json({
      ok: true,
      ticker: result.ticker,
      staleAfter: result.staleAfter,
      source,
      limit: dailyLimitForUser,
      usedToday: dailyLimitForUser !== null ? usedTodayBeforeCall + 1 : null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Refresh failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
