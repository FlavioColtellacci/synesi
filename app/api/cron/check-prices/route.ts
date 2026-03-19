import { NextResponse } from "next/server"
import { getDailyPriceChange } from "@/lib/alpha-vantage"
import { createAdminClient } from "@/lib/supabase/server"

type ThesisRow = { id: string; user_id: string; ticker: string }

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from("theses").select("id, user_id, ticker")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const theses: ThesisRow[] = data ?? []
  const tickerMap = new Map<string, Array<{ thesisId: string; userId: string }>>()

  for (const thesis of theses) {
    const ticker = thesis.ticker.toUpperCase()
    const holders = tickerMap.get(ticker) ?? []
    holders.push({ thesisId: thesis.id, userId: thesis.user_id })
    tickerMap.set(ticker, holders)
  }

  let processed = 0
  let triggered = 0
  let eventsInserted = 0
  const errors: string[] = []

  for (const [ticker, holders] of tickerMap) {
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
    errors,
  })
}
