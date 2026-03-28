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
import { getWebResearchContext } from "@/lib/web-research"
import type { FinancialSnapshotCoverage, FinancialSnapshotPayload } from "./types"
import { createLlm, getTextModel } from "@/lib/llm"

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

// Reject values the web model commonly hallucinates (wrong order of magnitude,
// percent-vs-decimal confusion, etc.). Returns null if outside plausible range.
function guardWebNumeric(value: number | null, min: number, max: number): number | null {
  if (value === null) return null
  if (value < min || value > max) return null
  return value
}

function tryParseFinancialJson(candidate: string): Record<string, unknown> | null {
  const trimmed = candidate.trim()
  const withoutTrailingCommas = trimmed.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")
  try {
    const parsed = JSON.parse(withoutTrailingCommas) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // ignore
  }
  return null
}

/** First `{` … matching `}` with string/escape awareness (lastIndexOf breaks on `}` inside strings). */
function extractFirstBalancedJsonObject(value: string): Record<string, unknown> | null {
  const text = value.trim()
  const start = text.indexOf("{")
  if (start === -1) return null

  let depth = 0
  let inString = false
  let isEscaped = false

  for (let i = start; i < text.length; i++) {
    const char = text[i]!

    if (inString) {
      if (isEscaped) {
        isEscaped = false
      } else if (char === "\\") {
        isEscaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }
    if (char === "{") {
      depth += 1
      continue
    }
    if (char === "}") {
      depth -= 1
      if (depth === 0) {
        const slice = text.slice(start, i + 1)
        const parsed = tryParseFinancialJson(slice)
        if (parsed) return parsed
        return null
      }
    }
  }

  return null
}

function extractJsonObject(input: string): Record<string, unknown> | null {
  const trimmed = input.trim()

  const direct = tryParseFinancialJson(trimmed)
  if (direct) return direct

  const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i)
  const candidateFromCodeBlock = codeBlockMatch?.[1]?.trim()
  if (candidateFromCodeBlock) {
    const fromFence = tryParseFinancialJson(candidateFromCodeBlock)
    if (fromFence) return fromFence
    const fromFenceBalanced = extractFirstBalancedJsonObject(candidateFromCodeBlock)
    if (fromFenceBalanced) return fromFenceBalanced
  }

  return extractFirstBalancedJsonObject(trimmed)
}

const WEB_SNAPSHOT_FOR_MODEL_MAX_CHARS = 5_500

/** Drop prose before the first `{` so parsers see JSON even if the model prefixes explanation. */
function stripLeadingProseBeforeJson(text: string) {
  const trimmed = text.trim()
  const i = trimmed.indexOf("{")
  return i > 0 ? trimmed.slice(i) : trimmed
}

async function buildWebSnapshotPayload(ticker: string): Promise<SnapshotBuildResult> {
  const normalizedTicker = ticker.trim().toUpperCase()
  const nowIso = new Date().toISOString()
  // Short query so web search stays under provider limits and returns finance-focused hits.
  const research = await getWebResearchContext({
    focus: "company",
    query: `${normalizedTicker} stock price PE ratio forward PE EPS analyst consensus target next earnings date RSI fundamentals`,
  })

  if (!research.ok) {
    return {
      ok: false,
      ticker: normalizedTicker,
      provider: "eodhd",
      error: research.error,
    }
  }

  const snapshotForModel =
    research.content.length > WEB_SNAPSHOT_FOR_MODEL_MAX_CHARS
      ? `${research.content.slice(0, WEB_SNAPSHOT_FOR_MODEL_MAX_CHARS)}\n\n[snapshot truncated]`
      : research.content

  const systemPrompt =
    "You extract structured financial fields from web search snippets. Reply with ONE JSON object only. Keys exactly: price, consensusTarget, pe, forwardPe, peg, roic, eps, fcfPerShare, rsi14, nextEarningsDate. Use null for unknown. Numbers only for numeric fields (no strings). roic as decimal (0.21 = 21%). nextEarningsDate as YYYY-MM-DD or null. No markdown, no prose, no code fences."

  const userPrompt = `Ticker ${normalizedTicker}. Use only the evidence below; guess null if not stated.

${snapshotForModel}`

  let extractedText = ""
  try {
    const llm = createLlm()
    const completion = await llm.messages.create({
      model: getTextModel(),
      max_tokens: 900,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })

    extractedText = stripLeadingProseBeforeJson(
      completion.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim(),
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown extraction error"
    return {
      ok: false,
      ticker: normalizedTicker,
      provider: "eodhd",
      error: `Failed to extract financial data from web context: ${message}`,
    }
  }

  let parsed = extractJsonObject(extractedText)

  if (!parsed) {
    try {
      const llm = createLlm()
      const repair = await llm.messages.create({
        model: getTextModel(),
        max_tokens: 600,
        temperature: 0,
        system:
          "Convert the user text into one valid JSON object only. Keys: price, consensusTarget, pe, forwardPe, peg, roic, eps, fcfPerShare, rsi14, nextEarningsDate. null if unknown. No markdown.",
        messages: [
          {
            role: "user",
            content: `Fix into valid JSON only. Input:\n${extractedText.slice(0, 3_000)}`,
          },
        ],
      })
      const repaired = stripLeadingProseBeforeJson(
        repair.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim(),
      )
      parsed = extractJsonObject(repaired)
    } catch {
      parsed = null
    }
  }

  if (!parsed) {
    return {
      ok: false,
      ticker: normalizedTicker,
      provider: "eodhd",
      error: "Unable to parse web financial response",
    }
  }

  const payload: FinancialSnapshotPayload = {
    // Price and target: must be a positive, plausible stock price (penny stocks up to $1M/share)
    price: guardWebNumeric(parseMaybeNumber(parsed.price), 0.001, 1_000_000),
    consensusTarget: guardWebNumeric(parseMaybeNumber(parsed.consensusTarget), 0.001, 1_000_000),
    // Valuation multiples: wide ranges to tolerate growth/value extremes
    pe: guardWebNumeric(parseMaybeNumber(parsed.pe), -9999, 9999),
    forwardPe: guardWebNumeric(parseMaybeNumber(parsed.forwardPe), -9999, 9999),
    peg: guardWebNumeric(parseMaybeNumber(parsed.peg), -999, 999),
    // ROIC in decimal form (0.21 = 21%); reject percent-form (e.g. 21 when 0.21 expected)
    roic: guardWebNumeric(parseMaybeNumber(parsed.roic), -5, 5),
    eps: guardWebNumeric(parseMaybeNumber(parsed.eps), -9999, 9999),
    fcfPerShare: guardWebNumeric(parseMaybeNumber(parsed.fcfPerShare), -9999, 9999),
    marginOfSafety: null,
    // RSI is strictly 0–100
    rsi14: guardWebNumeric(parseMaybeNumber(parsed.rsi14), 0, 100),
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

