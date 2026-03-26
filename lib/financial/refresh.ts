// Server-only, do not import in client components

import {
  getEarningsCalendar,
  getFundamentals,
  getInsiderTransactions,
  getLastRsi14,
  getRealTimeQuote,
} from "./providers/eodhd"
import { normalizeEodhdToSnapshot } from "./normalize"
import type { SnapshotBuildResult } from "./types"
import { createAdminClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"
import { getGlobalQuotePrice } from "@/lib/alpha-vantage"
import { getPerplexityResearchContext } from "@/lib/perplexity"
import type { FinancialSnapshotCoverage, FinancialSnapshotPayload } from "./types"

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function buildEodhdSnapshotPayload(ticker: string): Promise<SnapshotBuildResult> {
  const normalizedTicker = ticker.trim().toUpperCase()

  try {
    const now = new Date()
    const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [quoteResult, fundamentalsResult, rsiResult, insiderResult, earningsResult] =
      await Promise.allSettled([
        getRealTimeQuote(normalizedTicker),
        getFundamentals(normalizedTicker),
        getLastRsi14(normalizedTicker),
        getInsiderTransactions({
          ticker: normalizedTicker,
          from: toYmd(from30d),
          to: toYmd(now),
          limit: 200,
        }),
        getEarningsCalendar({
          tickers: [normalizedTicker],
          from: toYmd(now),
          to: toYmd(new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)),
        }),
      ])

    let quote = quoteResult.status === "fulfilled" ? quoteResult.value : null
    const fundamentals = fundamentalsResult.status === "fulfilled" ? fundamentalsResult.value : null
    const rsi14 = rsiResult.status === "fulfilled" ? rsiResult.value : null
    const insiderTransactions30d = insiderResult.status === "fulfilled" ? insiderResult.value : null
    const earningsCalendar = earningsResult.status === "fulfilled" ? earningsResult.value : null

    if (!quote || typeof quote.close !== "number" || !Number.isFinite(quote.close)) {
      const alphaQuote = await getGlobalQuotePrice(normalizedTicker)
      if (alphaQuote.ok) {
        quote = {
          code: normalizedTicker,
          close: alphaQuote.price,
        }
      }
    }

    const { payload, coverage } = normalizeEodhdToSnapshot({
      ticker: normalizedTicker,
      quote,
      fundamentals,
      rsi14,
      insiderTransactions30d,
      earningsCalendar,
    })

    const hasAnySignal = [
      payload.price,
      payload.consensusTarget,
      payload.pe,
      payload.forwardPe,
      payload.peg,
      payload.roic,
      payload.eps,
      payload.fcfPerShare,
      payload.rsi14,
      payload.nextEarningsDate,
      payload.insiderActivity30d,
    ].some((value) => value !== null)

    if (!hasAnySignal) {
      const errors = [
        quoteResult,
        fundamentalsResult,
        rsiResult,
        insiderResult,
        earningsResult,
      ]
        .filter((result) => result.status === "rejected")
        .map((result) => (result as PromiseRejectedResult).reason)
        .map((reason) => (reason instanceof Error ? reason.message : String(reason)))

      return {
        ok: false,
        ticker: normalizedTicker,
        provider: "eodhd",
        error: errors[0] ?? "No financial data available from provider",
      }
    }

    return {
      ok: true,
      ticker: normalizedTicker,
      provider: "eodhd",
      asOf: now.toISOString(),
      payload,
      coverage,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return {
      ok: false,
      ticker: normalizedTicker,
      provider: "eodhd",
      error: message,
    }
  }
}

type FinancialSnapshotInsert = Database["public"]["Tables"]["financial_snapshots"]["Insert"]

type PersistSnapshotResult =
  | { ok: true; ticker: string; staleAfter: string }
  | { ok: false; ticker: string; error: string }

type RefreshSource = "provider" | "web"

function getStaleAfterIso(now: Date, staleAfterHours: number): string {
  return new Date(now.getTime() + staleAfterHours * 60 * 60 * 1000).toISOString()
}

function parseMaybeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%\s,]/g, "")
    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function extractJsonObject(input: string): Record<string, unknown> | null {
  const trimmed = input.trim()
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
  } catch {
    // continue to codeblock/object extraction
  }

  const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i)
  const candidateFromCodeBlock = codeBlockMatch?.[1]?.trim()
  if (candidateFromCodeBlock) {
    try {
      const parsed = JSON.parse(candidateFromCodeBlock) as unknown
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
    } catch {
      // continue to brace extraction
    }
  }

  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1)
    try {
      const parsed = JSON.parse(candidate) as unknown
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
    } catch {
      return null
    }
  }

  return null
}

async function buildWebSnapshotPayload(ticker: string): Promise<SnapshotBuildResult> {
  const normalizedTicker = ticker.trim().toUpperCase()
  const nowIso = new Date().toISOString()
  const research = await getPerplexityResearchContext({
    focus: "company",
    model: "sonar",
    query: [
      `Return financial metrics for ${normalizedTicker}.`,
      "Respond ONLY with JSON object using keys:",
      "price, consensusTarget, pe, forwardPe, peg, roic, eps, fcfPerShare, rsi14, nextEarningsDate.",
      "Use null for unknown values.",
      "Rules:",
      "- price/targets/multiples/eps/fcfPerShare/rsi14/roic must be numbers or null",
      "- roic should be decimal form (e.g. 0.21 for 21%)",
      "- nextEarningsDate should be YYYY-MM-DD or null",
      "- do not include extra text",
    ].join("\n"),
  })

  if (!research.ok) {
    return {
      ok: false,
      ticker: normalizedTicker,
      provider: "eodhd",
      error: research.error,
    }
  }

  const parsed = extractJsonObject(research.content)
  if (!parsed) {
    return {
      ok: false,
      ticker: normalizedTicker,
      provider: "eodhd",
      error: "Unable to parse web financial response",
    }
  }

  const payload: FinancialSnapshotPayload = {
    price: parseMaybeNumber(parsed.price),
    consensusTarget: parseMaybeNumber(parsed.consensusTarget),
    pe: parseMaybeNumber(parsed.pe),
    forwardPe: parseMaybeNumber(parsed.forwardPe),
    peg: parseMaybeNumber(parsed.peg),
    roic: parseMaybeNumber(parsed.roic),
    eps: parseMaybeNumber(parsed.eps),
    fcfPerShare: parseMaybeNumber(parsed.fcfPerShare),
    marginOfSafety: null,
    rsi14: parseMaybeNumber(parsed.rsi14),
    insiderActivity30d: null,
    nextEarningsDate:
      typeof parsed.nextEarningsDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.nextEarningsDate)
        ? parsed.nextEarningsDate
        : null,
    recentTargetChanges: [],
    indexChanges: [],
  }

  if (
    payload.price !== null &&
    payload.consensusTarget !== null &&
    payload.price > 0 &&
    Number.isFinite(payload.consensusTarget)
  ) {
    payload.marginOfSafety = (payload.consensusTarget - payload.price) / payload.price
  }

  const coverage: FinancialSnapshotCoverage = {
    price: payload.price !== null ? "ok" : "missing",
    consensusTarget: payload.consensusTarget !== null ? "ok" : "missing",
    pe: payload.pe !== null ? "ok" : "missing",
    forwardPe: payload.forwardPe !== null ? "ok" : "missing",
    peg: payload.peg !== null ? "ok" : "missing",
    roic: payload.roic !== null ? "ok" : "missing",
    eps: payload.eps !== null ? "ok" : "missing",
    fcfPerShare: payload.fcfPerShare !== null ? "ok" : "missing",
    marginOfSafety: payload.marginOfSafety !== null ? "computed" : "missing",
    rsi14: payload.rsi14 !== null ? "ok" : "missing",
    insiderActivity30d: "missing",
    nextEarningsDate: payload.nextEarningsDate !== null ? "ok" : "missing",
    recentTargetChanges: "unsupported",
    indexChanges: "unsupported",
  }

  const hasAnySignal = [
    payload.price,
    payload.consensusTarget,
    payload.pe,
    payload.forwardPe,
    payload.peg,
    payload.roic,
    payload.eps,
    payload.fcfPerShare,
    payload.rsi14,
    payload.nextEarningsDate,
  ].some((value) => value !== null)

  if (!hasAnySignal) {
    return {
      ok: false,
      ticker: normalizedTicker,
      provider: "eodhd",
      error: "No usable financial fields returned from web search",
    }
  }

  return {
    ok: true,
    ticker: normalizedTicker,
    provider: "eodhd",
    asOf: nowIso,
    payload,
    coverage,
  }
}

export async function refreshFinancialSnapshot(params: {
  ticker: string
  staleAfterHours?: number
  source?: RefreshSource
}): Promise<PersistSnapshotResult> {
  const normalizedTicker = params.ticker.trim().toUpperCase()
  const staleAfterHours = params.staleAfterHours ?? 24
  const source = params.source ?? "provider"

  if (!normalizedTicker) {
    return { ok: false, ticker: "", error: "Ticker is required" }
  }

  const supabase = createAdminClient()

  const built =
    source === "web"
      ? await buildWebSnapshotPayload(normalizedTicker)
      : await buildEodhdSnapshotPayload(normalizedTicker)
  if (!built.ok) {
    return { ok: false, ticker: normalizedTicker, error: built.error }
  }

  const payloadToPersist = { ...built.payload }
  const coverageToPersist = { ...(built.coverage ?? {}) }

  if (source === "web") {
    const { data: existingSnapshot } = await supabase
      .from("financial_snapshots")
      .select("payload")
      .eq("ticker", normalizedTicker)
      .maybeSingle()

    const existingPayload = (existingSnapshot?.payload ?? {}) as Partial<FinancialSnapshotPayload>
    const mergeKeys: Array<keyof FinancialSnapshotPayload> = [
      "price",
      "consensusTarget",
      "pe",
      "forwardPe",
      "peg",
      "roic",
      "eps",
      "fcfPerShare",
      "marginOfSafety",
      "rsi14",
      "nextEarningsDate",
    ]

    for (const key of mergeKeys) {
      if (payloadToPersist[key] === null && existingPayload[key] !== undefined && existingPayload[key] !== null) {
        payloadToPersist[key] = existingPayload[key] as never
        if (coverageToPersist[key] === "missing") {
          coverageToPersist[key] = "ok"
        }
      }
    }
  }

  const now = new Date()
  const row: FinancialSnapshotInsert = {
    ticker: built.ticker,
    provider: source === "web" ? "ai_web" : built.provider,
    as_of: built.asOf,
    fetched_at: now.toISOString(),
    stale_after: getStaleAfterIso(now, staleAfterHours),
    payload: payloadToPersist as Record<string, unknown>,
    coverage: coverageToPersist as Record<string, unknown>,
  }

  const { error } = await supabase
    .from("financial_snapshots")
    .upsert(row, { onConflict: "ticker" })

  if (error) {
    return { ok: false, ticker: normalizedTicker, error: error.message }
  }

  return { ok: true, ticker: normalizedTicker, staleAfter: row.stale_after ?? "" }
}

export {}

