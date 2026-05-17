import { NextResponse } from "next/server"
import { refreshFinancialSnapshot } from "@/lib/financial/refresh"
import { isFirebaseBackend } from "@/lib/data/backend"
import { createRepositories } from "@/lib/data/repositories"
import { createAdminClient } from "@/lib/supabase/server"

type SnapshotRow = {
  ticker: string
  stale_after: string
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return parsed
}

function getMaxTickersPerRun(): number {
  return parsePositiveInt(process.env.CRON_MAX_FINANCIAL_TICKERS_PER_RUN, 5)
}

function getBatchSize(): number {
  return parsePositiveInt(process.env.CRON_FINANCIAL_BATCH_SIZE, 5)
}

function getBatchDelayMs(): number {
  return parsePositiveInt(process.env.CRON_FINANCIAL_BATCH_DELAY_MS, 1200)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const repositories = isFirebaseBackend()
      ? createRepositories({})
      : createRepositories({ supabase: createAdminClient() })

    const tickers = await repositories.theses.listNonBrokenTickers()
    const snapshotsData = await repositories.financialSnapshots.listStaleStatusByTickers(tickers)

    const nowMs = Date.now()
    const snapshotByTicker = new Map(
      (snapshotsData as SnapshotRow[]).map((row) => [row.ticker.toUpperCase(), row]),
    )

    // Respect low-tier API quotas: refresh only missing or stale snapshots.
    const refreshCandidates = tickers.filter((ticker) => {
      const snapshot = snapshotByTicker.get(ticker)
      if (!snapshot) return true
      return new Date(snapshot.stale_after).getTime() <= nowMs
    })

    const maxTickersPerRun = getMaxTickersPerRun()
    const batchSize = getBatchSize()
    const batchDelayMs = getBatchDelayMs()
    const tickersToProcess = refreshCandidates.slice(0, maxTickersPerRun)

    const refreshed: string[] = []
    const failed: Array<{ ticker: string; error: string }> = []

    for (let i = 0; i < tickersToProcess.length; i += batchSize) {
      const batch = tickersToProcess.slice(i, i + batchSize)
      const results = await Promise.all(batch.map((ticker) => refreshFinancialSnapshot({ ticker })))

      for (const result of results) {
        if (result.ok) {
          refreshed.push(result.ticker)
        } else {
          failed.push({ ticker: result.ticker, error: result.error })
        }
      }

      const hasMore = i + batchSize < tickersToProcess.length
      if (hasMore) {
        await sleep(batchDelayMs)
      }
    }

    return NextResponse.json({
      totalTrackedTickers: tickers.length,
      eligibleToRefresh: refreshCandidates.length,
      processed: tickersToProcess.length,
      refreshed: refreshed.length,
      failed: failed.length,
      limitedByMaxTickers: refreshCandidates.length > maxTickersPerRun,
      maxTickersPerRun,
      batchSize,
      batchDelayMs,
      errors: failed,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Cron refresh failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
