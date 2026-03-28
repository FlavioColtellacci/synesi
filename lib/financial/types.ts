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

export type FinancialCoverageStatus = "ok" | "missing" | "computed" | "unsupported"
export type FinancialMetricTier = "core" | "extended" | "optional"
export type FinancialMetricKey = keyof FinancialSnapshotPayload
export type FinancialFieldSource = "provider" | "alpha_vantage" | "brave_web" | "sonar_pro"

export const CORE_FINANCIAL_FIELDS = [
  "price",
  "consensusTarget",
  "pe",
  "forwardPe",
  "eps",
  "nextEarningsDate",
  "marginOfSafety",
] as const satisfies readonly FinancialMetricKey[]

export const EXTENDED_FINANCIAL_FIELDS = ["peg", "rsi14", "fcfPerShare", "roic"] as const satisfies readonly FinancialMetricKey[]

export const OPTIONAL_FINANCIAL_FIELDS = [
  "insiderActivity30d",
  "recentTargetChanges",
  "indexChanges",
] as const satisfies readonly FinancialMetricKey[]

export type FinancialFieldProvenance = {
  source: FinancialFieldSource
  confidence: number | null
  citations: string[]
  observedAt: string
}

export type FinancialSnapshotCoverage = Partial<Record<FinancialMetricKey, FinancialCoverageStatus>> & {
  _provenance?: Partial<Record<FinancialMetricKey, FinancialFieldProvenance>>
  _metrics?: {
    coreFilled: number
    coreTotal: number
    extendedFilled: number
    extendedTotal: number
    sonarFallbackUsed: boolean
  }
}

export type SnapshotBuildResult =
  | {
      ok: true
      ticker: string
      provider: "eodhd"
      asOf: string
      payload: FinancialSnapshotPayload
      coverage: FinancialSnapshotCoverage
      provenance?: Partial<Record<FinancialMetricKey, FinancialFieldProvenance>>
    }
  | {
      ok: false
      ticker: string
      provider: "eodhd"
      error: string
      coverage?: FinancialSnapshotCoverage
    }

export {}

