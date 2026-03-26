// Server-only, do not import in client components

import type { FinancialSnapshotCoverage, FinancialSnapshotPayload } from "./types"
import type {
  EodhdEarningsCalendarItem,
  EodhdFundamentals,
  EodhdInsiderTransaction,
  EodhdRealTimeQuote,
} from "./providers/eodhd"

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const n = Number.parseFloat(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function pick(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function buildInsiderActivity30d(transactions: EodhdInsiderTransaction[]) {
  let buyCount = 0
  let sellCount = 0
  let netShares: number | null = 0

  for (const tx of transactions) {
    const code = asString(tx.transaction_code)
    const shares = asNumber(tx.securities_transacted)

    if (code === "P") {
      buyCount += 1
      if (typeof shares === "number") netShares = (netShares ?? 0) + shares
    } else if (code === "S") {
      sellCount += 1
      if (typeof shares === "number") netShares = (netShares ?? 0) - shares
    }
  }

  const label =
    buyCount === 0 && sellCount === 0
      ? "Unknown"
      : netShares === null
        ? "Unknown"
        : netShares > 0
          ? "Net Buying"
          : netShares < 0
            ? "Net Selling"
            : "Neutral"

  return { label, buyCount, sellCount, netShares }
}

export function pickNextEarningsDate(params: {
  ticker: string
  calendar: EodhdEarningsCalendarItem[]
  now?: Date
}): string | null {
  const now = params.now ?? new Date()
  const today = toYmd(now)
  const normalized = params.ticker.trim().toUpperCase()

  const dates = params.calendar
    .filter((item) => {
      const code = asString(item.code)?.toUpperCase() ?? ""
      // Accept either AAPL or AAPL.US match.
      return code === normalized || code.startsWith(`${normalized}.`)
    })
    .map((item) => asString(item.report_date))
    .filter((d): d is string => Boolean(d))
    .filter((d) => d >= today)
    .sort()

  return dates[0] ?? null
}

export function normalizeEodhdToSnapshot(params: {
  ticker: string
  quote: EodhdRealTimeQuote | null
  fundamentals: EodhdFundamentals | null
  rsi14: number | null
  insiderTransactions30d: EodhdInsiderTransaction[] | null
  earningsCalendar: EodhdEarningsCalendarItem[] | null
}): { payload: FinancialSnapshotPayload; coverage: FinancialSnapshotCoverage } {
  const coverage: FinancialSnapshotCoverage = {}

  const price = params.quote ? asNumber(params.quote.close) : null
  coverage.price = price === null ? "missing" : "ok"

  // EODHD fundamentals is a large JSON; fields vary by market. We try a few common paths.
  const trailingPe =
    asNumber(pick(params.fundamentals, ["Highlights", "PERatio"])) ??
    asNumber(pick(params.fundamentals, ["Valuation", "TrailingPE"])) ??
    asNumber(pick(params.fundamentals, ["Highlights", "TrailingPE"])) ??
    null

  const forwardPe =
    asNumber(pick(params.fundamentals, ["Valuation", "ForwardPE"])) ??
    asNumber(pick(params.fundamentals, ["Highlights", "ForwardPE"])) ??
    null

  const peg =
    asNumber(pick(params.fundamentals, ["Highlights", "PEGRatio"])) ??
    asNumber(pick(params.fundamentals, ["Valuation", "PEGRatio"])) ??
    null

  const eps =
    asNumber(pick(params.fundamentals, ["Highlights", "EarningsShare"])) ??
    asNumber(pick(params.fundamentals, ["Highlights", "EPS"])) ??
    null

  // ROIC: not always present; keep as null if missing.
  const roic =
    asNumber(pick(params.fundamentals, ["Highlights", "ROIC"])) ??
    asNumber(pick(params.fundamentals, ["Technicals", "ROIC"])) ??
    null

  // FCF/share: prefer direct, else attempt compute from freeCashFlow / sharesOutstanding.
  const freeCashFlow =
    asNumber(pick(params.fundamentals, ["Cash_Flow", "freeCashFlow"])) ??
    asNumber(pick(params.fundamentals, ["CashFlow", "freeCashFlow"])) ??
    null

  const sharesOutstanding =
    asNumber(pick(params.fundamentals, ["SharesStats", "SharesOutstanding"])) ??
    asNumber(pick(params.fundamentals, ["Shares", "SharesOutstanding"])) ??
    asNumber(pick(params.fundamentals, ["General", "SharesOutstanding"])) ??
    null

  const fcfPerShareDirect =
    asNumber(pick(params.fundamentals, ["Highlights", "FreeCashFlowPerShare"])) ??
    asNumber(pick(params.fundamentals, ["Highlights", "FCFPerShare"])) ??
    null

  const fcfPerShare =
    fcfPerShareDirect ??
    (freeCashFlow !== null && sharesOutstanding && sharesOutstanding !== 0
      ? freeCashFlow / sharesOutstanding
      : null)

  if (fcfPerShareDirect !== null) {
    coverage.fcfPerShare = "ok"
  } else if (fcfPerShare !== null) {
    coverage.fcfPerShare = "computed"
  } else {
    coverage.fcfPerShare = "missing"
  }

  coverage.pe = trailingPe === null ? "missing" : "ok"
  coverage.forwardPe = forwardPe === null ? "missing" : "ok"
  coverage.peg = peg === null ? "missing" : "ok"
  coverage.eps = eps === null ? "missing" : "ok"
  coverage.roic = roic === null ? "missing" : "ok"

  // Analyst consensus target: confirmed common EODHD path is Highlights.WallStreetTargetPrice.
  // Keep fallback paths to stay resilient across plan/market differences.
  const consensusTarget =
    asNumber(pick(params.fundamentals, ["Highlights", "WallStreetTargetPrice"])) ??
    asNumber(pick(params.fundamentals, ["Highlights", "AnalystTargetPrice"])) ??
    asNumber(pick(params.fundamentals, ["Highlights", "OneYearTarget"])) ??
    asNumber(pick(params.fundamentals, ["Highlights", "TargetMeanPrice"])) ??
    null
  coverage.consensusTarget = consensusTarget === null ? "missing" : "ok"

  const marginOfSafety =
    price !== null && consensusTarget !== null && price !== 0
      ? (consensusTarget - price) / price
      : null
  coverage.marginOfSafety =
    marginOfSafety === null
      ? consensusTarget === null || price === null
        ? "missing"
        : "computed"
      : "computed"

  const rsi14 = params.rsi14
  coverage.rsi14 = rsi14 === null ? "missing" : "ok"

  const insiderActivity30d = params.insiderTransactions30d
    ? buildInsiderActivity30d(params.insiderTransactions30d)
    : null
  coverage.insiderActivity30d = insiderActivity30d === null ? "missing" : "ok"

  const nextEarningsDate =
    params.earningsCalendar && params.earningsCalendar.length
      ? pickNextEarningsDate({ ticker: params.ticker, calendar: params.earningsCalendar })
      : null
  coverage.nextEarningsDate = nextEarningsDate === null ? "missing" : "ok"

  // Not implemented in step 2: recent target changes, index changes.
  const recentTargetChanges: FinancialSnapshotPayload["recentTargetChanges"] = []
  const indexChanges: FinancialSnapshotPayload["indexChanges"] = []
  coverage.recentTargetChanges = "unsupported"
  coverage.indexChanges = "unsupported"

  return {
    payload: {
      price,
      consensusTarget,
      pe: trailingPe,
      forwardPe,
      peg,
      roic,
      eps,
      fcfPerShare,
      marginOfSafety,
      rsi14,
      insiderActivity30d,
      nextEarningsDate,
      recentTargetChanges,
      indexChanges,
    },
    coverage,
  }
}

export {}

