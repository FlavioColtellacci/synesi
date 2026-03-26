// Server-only, do not import in client components

export type InsiderActivity30d = {
  label: "Net Buying" | "Net Selling" | "Neutral" | "Unknown"
  buyCount: number
  sellCount: number
  netShares: number | null
}

export type FinancialSnapshotPayload = {
  price: number | null
  consensusTarget: number | null
  pe: number | null
  forwardPe: number | null
  peg: number | null
  roic: number | null
  eps: number | null
  fcfPerShare: number | null
  marginOfSafety: number | null // (target - price) / price
  rsi14: number | null
  insiderActivity30d: InsiderActivity30d | null
  nextEarningsDate: string | null // YYYY-MM-DD
  recentTargetChanges: Array<{
    firm: string | null
    action: string | null
    from: number | null
    to: number | null
    date: string | null
  }>
  indexChanges: Array<{
    index: string
    action: "Added" | "Removed"
    date: string | null
  }>
}

export type FinancialSnapshotCoverage = Partial<
  Record<keyof FinancialSnapshotPayload, "ok" | "missing" | "computed" | "unsupported">
>

export type SnapshotBuildResult =
  | {
      ok: true
      ticker: string
      provider: "eodhd"
      asOf: string
      payload: FinancialSnapshotPayload
      coverage: FinancialSnapshotCoverage
    }
  | {
      ok: false
      ticker: string
      provider: "eodhd"
      error: string
      coverage?: FinancialSnapshotCoverage
    }

export {}

