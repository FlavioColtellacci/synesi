import { NextResponse } from "next/server"
import { getDailyPriceChange } from "@/lib/alpha-vantage"
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

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("theses")
    .select("id, user_id, ticker")
    .neq("status", "broken")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const theses: ThesisRow[] = data ?? []

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
  const { data: todayEvents, error: eventsError } = await supabase
    .from("events")
    .select("thesis_id")
    .eq("event_type", "price_move")
    .gte("created_at", dayStartIso)
    .in("thesis_id", thesisIds)

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 })
  }

  const alreadyAlertedToday = new Set(
    ((todayEvents ?? []) as EventRow[]).map((event) => event.thesis_id),
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

    const { error: insertError } = await supabase.from("events").insert(eventsToInsert)
    if (insertError) {
      errors.push(`${ticker}: ${insertError.message}`)
      continue
    }

    eventsInserted += eventsToInsert.length
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
