import { NextResponse } from "next/server"
import { getDailyPriceChange } from "@/lib/alpha-vantage"
import { sendAlertPushToUser } from "@/lib/push/send-alert"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import { createAdminClient } from "@/lib/supabase/server"

type ThesisRow = { id: string; user_id: string; ticker: string }
type EventRow = { thesis_id: string }

function getStartOfUtcDayIso() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

function getMaxTickersPerRun() {
  const parsed = Number.parseInt(process.env.CRON_MAX_TICKERS_PER_RUN ?? "", 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 8
  }
  return parsed
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const usingFirestore = isFirebaseBackend()
  const supabase = usingFirestore ? null : createAdminClient()
  const firestore = usingFirestore ? getFirebaseAdminFirestore() : null

  const theses: ThesisRow[] = await (async () => {
    if (usingFirestore && firestore) {
      const snapshot = await firestore.collection("theses").where("status", "!=", "broken").get()
      return snapshot.docs.map((doc) => {
        const data = (doc.data() ?? {}) as Record<string, unknown>
        return {
          id: doc.id,
          user_id: typeof data.user_id === "string" ? data.user_id : "",
          ticker: typeof data.ticker === "string" ? data.ticker : "",
        }
      })
    }

    const { data, error } = await supabase!
      .from("theses")
      .select("id, user_id, ticker")
      .neq("status", "broken")
    if (error) {
      throw new Error(error.message)
    }
    return data ?? []
  })().catch((error: unknown) => {
    throw error
  })

  if (theses.length === 0) {
    return NextResponse.json({
      processed: 0,
      triggered: 0,
      eventsInserted: 0,
      skippedAlreadyAlertedToday: 0,
      limitedByMaxTickers: false,
      errors: [],
    })
  }

  const dayStartIso = getStartOfUtcDayIso()
  const thesisIds = theses.map((thesis) => thesis.id)
  const todayEvents: EventRow[] = await (async () => {
    if (usingFirestore && firestore) {
      const rows: EventRow[] = []
      for (let index = 0; index < thesisIds.length; index += 30) {
        const chunk = thesisIds.slice(index, index + 30)
        const snapshot = await firestore
          .collection("events")
          .where("event_type", "==", "price_move")
          .where("created_at", ">=", dayStartIso)
          .where("thesis_id", "in", chunk)
          .get()
        rows.push(
          ...snapshot.docs.map((doc) => {
            const data = (doc.data() ?? {}) as Record<string, unknown>
            return { thesis_id: typeof data.thesis_id === "string" ? data.thesis_id : "" }
          }),
        )
      }
      return rows
    }

    const { data, error } = await supabase!
      .from("events")
      .select("thesis_id")
      .eq("event_type", "price_move")
      .gte("created_at", dayStartIso)
      .in("thesis_id", thesisIds)
    if (error) {
      throw new Error(error.message)
    }
    return (data ?? []) as EventRow[]
  })().catch((error: unknown) => {
    throw error
  })

  const alreadyAlertedToday = new Set(
    todayEvents.map((event) => event.thesis_id),
  )
  const tickerMap = new Map<string, Array<{ thesisId: string; userId: string }>>()

  for (const thesis of theses) {
    if (alreadyAlertedToday.has(thesis.id)) {
      continue
    }

    const ticker = thesis.ticker.toUpperCase()
    const holders = tickerMap.get(ticker) ?? []
    holders.push({ thesisId: thesis.id, userId: thesis.user_id })
    tickerMap.set(ticker, holders)
  }

  const maxTickers = getMaxTickersPerRun()
  const tickerEntries = Array.from(tickerMap.entries()).slice(0, maxTickers)
  let processed = 0
  let triggered = 0
  let eventsInserted = 0
  const skippedAlreadyAlertedToday = theses.length - Array.from(tickerMap.values()).flat().length
  const limitedByMaxTickers = tickerMap.size > maxTickers
  const errors: string[] = []

  for (const [ticker, holders] of tickerEntries) {
    processed += 1

    const result = await getDailyPriceChange(ticker)
    if (!result.ok) {
      errors.push(`${ticker}: ${result.error}`)
      continue
    }

    if (Math.abs(result.changePercent) < 5) {
      continue
    }

    triggered += 1

    const eventDetail = `${ticker} moved ${result.changePercent > 0 ? "+" : ""}${result.changePercent.toFixed(2)}% on ${result.latestTradingDay}`
    const eventsToInsert = holders.map((holder) => ({
      thesis_id: holder.thesisId,
      user_id: holder.userId,
      event_type: "price_move",
      event_detail: eventDetail,
      is_reviewed: false,
    }))

    if (usingFirestore && firestore) {
      const batch = firestore.batch()
      for (const event of eventsToInsert) {
        const eventId = crypto.randomUUID()
        batch.set(firestore.collection("events").doc(eventId), {
          id: eventId,
          ...event,
          created_at: new Date().toISOString(),
        })
      }
      try {
        await batch.commit()
      } catch (error) {
        errors.push(`${ticker}: ${error instanceof Error ? error.message : "Failed to insert events"}`)
        continue
      }
    } else {
      const { error: insertError } = await supabase!.from("events").insert(eventsToInsert)
      if (insertError) {
        errors.push(`${ticker}: ${insertError.message}`)
        continue
      }
    }

    eventsInserted += eventsToInsert.length

    const uniqueUserIds = [...new Set(holders.map((h) => h.userId))]
    await Promise.allSettled(
      uniqueUserIds.map((userId) =>
        sendAlertPushToUser(usingFirestore && firestore ? firestore : supabase!, userId, {
          title: "SYNESI · Price alert",
          body: eventDetail.length > 140 ? `${eventDetail.slice(0, 137)}…` : eventDetail,
          url: "/app/convictions?panel=alerts",
          tag: `price-${ticker}-${dayStartIso}`,
        }),
      ),
    )
  }

  return NextResponse.json({
    processed,
    triggered,
    eventsInserted,
    skippedAlreadyAlertedToday,
    limitedByMaxTickers,
    maxTickersPerRun: maxTickers,
    errors,
  })
}
