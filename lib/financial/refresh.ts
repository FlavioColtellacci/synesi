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
import type { Database } from "@/types/database"
import { createAdminFinancialSnapshotRepository } from "@/lib/data/repositories/financial-snapshots"
import { getGlobalQuotePrice } from "@/lib/alpha-vantage"
import { getWebResearchContext } from "@/lib/web-research"
import {
  CORE_FINANCIAL_FIELDS,
  EXTENDED_FINANCIAL_FIELDS,
  OPTIONAL_FINANCIAL_FIELDS,
} from "./types"
import type {
  FinancialFieldProvenance,
  FinancialFieldSource,
  FinancialMetricKey,
  FinancialSnapshotCoverage,
  FinancialSnapshotPayload,
} from "./types"
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

    let usedAlphaVantageForPrice = false
    if (!quote || typeof quote.close !== "number" || !Number.isFinite(quote.close)) {
      const alphaQuote = await getGlobalQuotePrice(normalizedTicker)
      if (alphaQuote.ok) {
        usedAlphaVantageForPrice = true
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
      provenance: {
        ...markPopulatedFieldsWithSource(payload, "provider", now.toISOString(), [], 0.95),
        ...(usedAlphaVantageForPrice && payload.price !== null
          ? {
              price: {
                source: "alpha_vantage" as const,
                confidence: 0.9,
                citations: [],
                observedAt: now.toISOString(),
              },
            }
          : {}),
      },
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

const HYBRID_REFRESH_DEFAULT_ENABLED = true
const FINANCIAL_WEB_MAX_BRAVE_CALLS = 1
const FINANCIAL_WEB_MAX_SONAR_CALLS = 1

function isHybridRefreshEnabled(): boolean {
  const value = process.env.FINANCIAL_HYBRID_REFRESH_ENABLED?.trim().toLowerCase()
  if (!value) return HYBRID_REFRESH_DEFAULT_ENABLED
  return !["0", "false", "off", "no"].includes(value)
}

function isExtendedEnrichmentEnabled(): boolean {
  const value = process.env.FINANCIAL_EXTENDED_ENRICHMENT_ENABLED?.trim().toLowerCase()
  if (!value) return false
  return ["1", "true", "on", "yes"].includes(value)
}

function canUseSonarFallback(): boolean {
  return Boolean(process.env.PERPLEXITY_API_KEY?.trim())
}

function createEmptySnapshotPayload(): FinancialSnapshotPayload {
  return {
    price: null,
    consensusTarget: null,
    pe: null,
    forwardPe: null,
    peg: null,
    roic: null,
    eps: null,
    fcfPerShare: null,
    marginOfSafety: null,
    rsi14: null,
    insiderActivity30d: null,
    nextEarningsDate: null,
    recentTargetChanges: [],
    indexChanges: [],
  }
}

function coerceSnapshotPayload(raw: Partial<FinancialSnapshotPayload> | null | undefined): FinancialSnapshotPayload {
  if (!raw) return createEmptySnapshotPayload()
  return {
    price: raw.price ?? null,
    consensusTarget: raw.consensusTarget ?? null,
    pe: raw.pe ?? null,
    forwardPe: raw.forwardPe ?? null,
    peg: raw.peg ?? null,
    roic: raw.roic ?? null,
    eps: raw.eps ?? null,
    fcfPerShare: raw.fcfPerShare ?? null,
    marginOfSafety: raw.marginOfSafety ?? null,
    rsi14: raw.rsi14 ?? null,
    insiderActivity30d: raw.insiderActivity30d ?? null,
    nextEarningsDate: raw.nextEarningsDate ?? null,
    recentTargetChanges: Array.isArray(raw.recentTargetChanges) ? raw.recentTargetChanges : [],
    indexChanges: Array.isArray(raw.indexChanges) ? raw.indexChanges : [],
  }
}

function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

function isFinancialFieldPopulated(field: FinancialMetricKey, payload: FinancialSnapshotPayload): boolean {
  const value = payload[field]
  if (field === "recentTargetChanges" || field === "indexChanges") return Array.isArray(value) && value.length > 0
  return !isNullish(value)
}

function computeMarginOfSafety(payload: FinancialSnapshotPayload): number | null {
  if (
    typeof payload.price === "number" &&
    Number.isFinite(payload.price) &&
    payload.price !== 0 &&
    typeof payload.consensusTarget === "number" &&
    Number.isFinite(payload.consensusTarget)
  ) {
    return (payload.consensusTarget - payload.price) / payload.price
  }
  return null
}

function buildCoverageFromPayload(payload: FinancialSnapshotPayload): FinancialSnapshotCoverage {
  const margin = computeMarginOfSafety(payload)
  return {
    price: payload.price === null ? "missing" : "ok",
    consensusTarget: payload.consensusTarget === null ? "missing" : "ok",
    pe: payload.pe === null ? "missing" : "ok",
    forwardPe: payload.forwardPe === null ? "missing" : "ok",
    peg: payload.peg === null ? "missing" : "ok",
    roic: payload.roic === null ? "missing" : "ok",
    eps: payload.eps === null ? "missing" : "ok",
    fcfPerShare: payload.fcfPerShare === null ? "missing" : "ok",
    marginOfSafety: margin === null ? "missing" : "computed",
    rsi14: payload.rsi14 === null ? "missing" : "ok",
    insiderActivity30d: payload.insiderActivity30d === null ? "missing" : "ok",
    nextEarningsDate: payload.nextEarningsDate === null ? "missing" : "ok",
    recentTargetChanges: "unsupported",
    indexChanges: "unsupported",
  }
}

export function countFilledMetrics(
  payload: FinancialSnapshotPayload,
  fields: readonly FinancialMetricKey[],
): { filled: number; total: number } {
  const total = fields.length
  const filled = fields.filter((field) => isFinancialFieldPopulated(field, payload)).length
  return { filled, total }
}

export function getMissingMetrics(
  payload: FinancialSnapshotPayload,
  fields: readonly FinancialMetricKey[],
): FinancialMetricKey[] {
  return fields.filter((field) => !isFinancialFieldPopulated(field, payload))
}

export function mergeSnapshotPayloadNoRegression(
  basePayload: FinancialSnapshotPayload,
  incomingPayload: Partial<FinancialSnapshotPayload>,
): FinancialSnapshotPayload {
  const merged: FinancialSnapshotPayload = { ...basePayload }
  const fillableFields: FinancialMetricKey[] = [
    "price",
    "consensusTarget",
    "pe",
    "forwardPe",
    "peg",
    "roic",
    "eps",
    "fcfPerShare",
    "rsi14",
    "nextEarningsDate",
    "insiderActivity30d",
  ]

  for (const field of fillableFields) {
    if (!isNullish(merged[field])) continue
    const candidate = incomingPayload[field]
    if (!isNullish(candidate)) {
      merged[field] = candidate as never
    }
  }

  if ((merged.recentTargetChanges?.length ?? 0) === 0 && (incomingPayload.recentTargetChanges?.length ?? 0) > 0) {
    merged.recentTargetChanges = incomingPayload.recentTargetChanges ?? []
  }
  if ((merged.indexChanges?.length ?? 0) === 0 && (incomingPayload.indexChanges?.length ?? 0) > 0) {
    merged.indexChanges = incomingPayload.indexChanges ?? []
  }

  merged.marginOfSafety = computeMarginOfSafety(merged)
  return merged
}

function markPopulatedFieldsWithSource(
  payload: FinancialSnapshotPayload,
  source: FinancialFieldSource,
  observedAt: string,
  citations: string[] = [],
  confidence: number | null = null,
): Partial<Record<FinancialMetricKey, FinancialFieldProvenance>> {
  const map: Partial<Record<FinancialMetricKey, FinancialFieldProvenance>> = {}
  const fields: FinancialMetricKey[] = [
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
    "insiderActivity30d",
    "nextEarningsDate",
    "recentTargetChanges",
    "indexChanges",
  ]
  for (const field of fields) {
    if (!isFinancialFieldPopulated(field, payload)) continue
    map[field] = { source, confidence, citations, observedAt }
  }
  return map
}

function mergeProvenanceNoRegression(params: {
  current: Partial<Record<FinancialMetricKey, FinancialFieldProvenance>>
  incoming: Partial<Record<FinancialMetricKey, FinancialFieldProvenance>>
  beforeMergePayload: FinancialSnapshotPayload
  afterMergePayload: FinancialSnapshotPayload
}) {
  const merged = { ...params.current }
  for (const [field, incomingMetadata] of Object.entries(params.incoming) as Array<
    [FinancialMetricKey, FinancialFieldProvenance]
  >) {
    const beforeValue = params.beforeMergePayload[field]
    const afterValue = params.afterMergePayload[field]
    const fieldWasFilledByIncoming = isNullish(beforeValue) && !isNullish(afterValue)
    if (fieldWasFilledByIncoming && incomingMetadata) {
      merged[field] = incomingMetadata
    }
  }
  return merged
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
const CORE_WEB_EXTRACT_FIELDS: FinancialMetricKey[] = [
  "price",
  "consensusTarget",
  "pe",
  "forwardPe",
  "eps",
  "nextEarningsDate",
]

/** Drop prose before the first `{` so parsers see JSON even if the model prefixes explanation. */
function stripLeadingProseBeforeJson(text: string) {
  const trimmed = text.trim()
  const i = trimmed.indexOf("{")
  return i > 0 ? trimmed.slice(i) : trimmed
}

function toTargetExtractFields(missingFields: FinancialMetricKey[]): FinancialMetricKey[] {
  const fields = missingFields.filter((field) => field !== "marginOfSafety")
  if (fields.length === 0) {
    return [...CORE_WEB_EXTRACT_FIELDS]
  }
  return fields
}

function parseExtractedPayload(parsed: Record<string, unknown>): FinancialSnapshotPayload {
  const payload = createEmptySnapshotPayload()
  payload.price = guardWebNumeric(parseMaybeNumber(parsed.price), 0.001, 1_000_000)
  payload.consensusTarget = guardWebNumeric(parseMaybeNumber(parsed.consensusTarget), 0.001, 1_000_000)
  payload.pe = guardWebNumeric(parseMaybeNumber(parsed.pe), -9999, 9999)
  payload.forwardPe = guardWebNumeric(parseMaybeNumber(parsed.forwardPe), -9999, 9999)
  payload.peg = guardWebNumeric(parseMaybeNumber(parsed.peg), -999, 999)
  payload.roic = guardWebNumeric(parseMaybeNumber(parsed.roic), -5, 5)
  payload.eps = guardWebNumeric(parseMaybeNumber(parsed.eps), -9999, 9999)
  payload.fcfPerShare = guardWebNumeric(parseMaybeNumber(parsed.fcfPerShare), -9999, 9999)
  payload.rsi14 = guardWebNumeric(parseMaybeNumber(parsed.rsi14), 0, 100)
  payload.nextEarningsDate =
    typeof parsed.nextEarningsDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.nextEarningsDate)
      ? parsed.nextEarningsDate
      : null
  payload.marginOfSafety = computeMarginOfSafety(payload)
  return payload
}

async function buildBraveWebSnapshotPayload(params: {
  ticker: string
  missingFields: FinancialMetricKey[]
}): Promise<SnapshotBuildResult> {
  const normalizedTicker = params.ticker.trim().toUpperCase()
  const nowIso = new Date().toISOString()
  const targetFields = toTargetExtractFields(params.missingFields)
  const queryFields = targetFields.map((field) => field.replace(/[A-Z]/g, (char) => ` ${char}`)).join(" ")
  const research = await getWebResearchContext({
    focus: "company",
    query: `${normalizedTicker} stock ${queryFields} analyst consensus target valuation metrics earnings date`,
  })

  if (!research.ok) {
    return { ok: false, ticker: normalizedTicker, provider: "eodhd", error: research.error }
  }

  const snapshotForModel =
    research.content.length > WEB_SNAPSHOT_FOR_MODEL_MAX_CHARS
      ? `${research.content.slice(0, WEB_SNAPSHOT_FOR_MODEL_MAX_CHARS)}\n\n[snapshot truncated]`
      : research.content

  const systemPrompt = `You extract financial fields from web snippets.
Reply with ONE JSON object only.
Allowed keys: price, consensusTarget, pe, forwardPe, peg, roic, eps, fcfPerShare, rsi14, nextEarningsDate.
Return null for unknown.
Numeric fields must be numbers.
roic must be decimal form (0.21 for 21%).
nextEarningsDate must be YYYY-MM-DD or null.
No markdown, no prose.`

  const userPrompt = `Ticker ${normalizedTicker}. Prioritize only these fields: ${targetFields.join(", ")}.
Use only the evidence below and return a single JSON object:

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
      error: `Failed to extract financial data from Brave context: ${message}`,
    }
  }

  const parsed = extractJsonObject(extractedText)
  if (!parsed) {
    return { ok: false, ticker: normalizedTicker, provider: "eodhd", error: "Unable to parse Brave payload" }
  }

  const payload = parseExtractedPayload(parsed)
  const coverage = buildCoverageFromPayload(payload)
  const hasAnySignal = targetFields.some((field) => isFinancialFieldPopulated(field, payload))
  if (!hasAnySignal) {
    return {
      ok: false,
      ticker: normalizedTicker,
      provider: "eodhd",
      error: "Brave returned no usable values for missing core fields",
    }
  }

  return {
    ok: true,
    ticker: normalizedTicker,
    provider: "eodhd",
    asOf: nowIso,
    payload,
    coverage,
    provenance: markPopulatedFieldsWithSource(payload, "brave_web", nowIso, research.citations, 0.58),
  }
}

type PerplexityChatResponse = {
  citations?: string[]
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

async function buildSonarSnapshotPayload(params: {
  ticker: string
  missingFields: FinancialMetricKey[]
}): Promise<SnapshotBuildResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim()
  const normalizedTicker = params.ticker.trim().toUpperCase()
  if (!apiKey) {
    return { ok: false, ticker: normalizedTicker, provider: "eodhd", error: "Sonar fallback is not configured" }
  }

  const nowIso = new Date().toISOString()
  const targetFields = toTargetExtractFields(params.missingFields)
  const body = {
    model: "sonar-pro",
    temperature: 0,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content:
          "Extract structured finance data. Return one JSON object only with keys: price, consensusTarget, pe, forwardPe, peg, roic, eps, fcfPerShare, rsi14, nextEarningsDate. Use null when unknown.",
      },
      {
        role: "user",
        content: `Ticker ${normalizedTicker}. Focus on these missing fields first: ${targetFields.join(", ")}.
Output only JSON.`,
      },
    ],
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 13_000)
  let response: Response
  try {
    response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error: unknown) {
    clearTimeout(timeoutId)
    const message = error instanceof Error ? error.message : "Unknown Sonar error"
    return { ok: false, ticker: normalizedTicker, provider: "eodhd", error: `Sonar fallback failed: ${message}` }
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const text = (await response.text().catch(() => "")).trim()
    return {
      ok: false,
      ticker: normalizedTicker,
      provider: "eodhd",
      error: `Sonar request failed (${response.status}): ${text || response.statusText}`,
    }
  }

  const data = (await response.json()) as PerplexityChatResponse
  const extractedText = stripLeadingProseBeforeJson(data.choices?.[0]?.message?.content?.trim() ?? "")
  const parsed = extractJsonObject(extractedText)
  if (!parsed) {
    return { ok: false, ticker: normalizedTicker, provider: "eodhd", error: "Unable to parse Sonar payload" }
  }

  const payload = parseExtractedPayload(parsed)
  const coverage = buildCoverageFromPayload(payload)
  const hasAnySignal = targetFields.some((field) => isFinancialFieldPopulated(field, payload))
  if (!hasAnySignal) {
    return {
      ok: false,
      ticker: normalizedTicker,
      provider: "eodhd",
      error: "Sonar returned no usable values for remaining core fields",
    }
  }

  return {
    ok: true,
    ticker: normalizedTicker,
    provider: "eodhd",
    asOf: nowIso,
    payload,
    coverage,
    provenance: markPopulatedFieldsWithSource(
      payload,
      "sonar_pro",
      nowIso,
      (data.citations ?? []).filter((citation): citation is string => typeof citation === "string"),
      0.66,
    ),
  }
}

async function buildHybridSnapshotPayload(ticker: string): Promise<SnapshotBuildResult> {
  const normalizedTicker = ticker.trim().toUpperCase()
  const providerResult = await buildEodhdSnapshotPayload(normalizedTicker)
  const nowIso = new Date().toISOString()

  let mergedPayload = providerResult.ok ? providerResult.payload : createEmptySnapshotPayload()
  let mergedProvenance: Partial<Record<FinancialMetricKey, FinancialFieldProvenance>> = providerResult.ok
    ? { ...(providerResult.provenance ?? {}) }
    : {}

  let braveCalls = 0
  let sonarCalls = 0
  let sonarFallbackUsed = false

  const initialCoreMissing = getMissingMetrics(mergedPayload, CORE_FINANCIAL_FIELDS)
  let coreMissing = [...initialCoreMissing]

  if (coreMissing.length > 0 && braveCalls < FINANCIAL_WEB_MAX_BRAVE_CALLS) {
    const braveResult = await buildBraveWebSnapshotPayload({ ticker: normalizedTicker, missingFields: coreMissing })
    braveCalls += 1
    if (braveResult.ok) {
      const before = mergedPayload
      const after = mergeSnapshotPayloadNoRegression(mergedPayload, braveResult.payload)
      mergedPayload = after
      mergedProvenance = mergeProvenanceNoRegression({
        current: mergedProvenance,
        incoming: braveResult.provenance ?? {},
        beforeMergePayload: before,
        afterMergePayload: after,
      })
      coreMissing = getMissingMetrics(mergedPayload, CORE_FINANCIAL_FIELDS)
    }
  }

  if (coreMissing.length > 0 && canUseSonarFallback() && sonarCalls < FINANCIAL_WEB_MAX_SONAR_CALLS) {
    const sonarResult = await buildSonarSnapshotPayload({ ticker: normalizedTicker, missingFields: coreMissing })
    sonarCalls += 1
    if (sonarResult.ok) {
      const before = mergedPayload
      const after = mergeSnapshotPayloadNoRegression(mergedPayload, sonarResult.payload)
      mergedPayload = after
      mergedProvenance = mergeProvenanceNoRegression({
        current: mergedProvenance,
        incoming: sonarResult.provenance ?? {},
        beforeMergePayload: before,
        afterMergePayload: after,
      })
      coreMissing = getMissingMetrics(mergedPayload, CORE_FINANCIAL_FIELDS)
      sonarFallbackUsed = true
    }
  }

  if (isExtendedEnrichmentEnabled() && coreMissing.length === 0) {
    const missingExtended = getMissingMetrics(mergedPayload, EXTENDED_FINANCIAL_FIELDS)
    if (missingExtended.length > 0 && braveCalls < FINANCIAL_WEB_MAX_BRAVE_CALLS) {
      const braveResult = await buildBraveWebSnapshotPayload({
        ticker: normalizedTicker,
        missingFields: missingExtended,
      })
      braveCalls += 1
      if (braveResult.ok) {
        const before = mergedPayload
        const after = mergeSnapshotPayloadNoRegression(mergedPayload, braveResult.payload)
        mergedPayload = after
        mergedProvenance = mergeProvenanceNoRegression({
          current: mergedProvenance,
          incoming: braveResult.provenance ?? {},
          beforeMergePayload: before,
          afterMergePayload: after,
        })
      }
    }
  }

  const coverage = buildCoverageFromPayload(mergedPayload)
  const coreCoverage = countFilledMetrics(mergedPayload, CORE_FINANCIAL_FIELDS)
  const extendedCoverage = countFilledMetrics(mergedPayload, EXTENDED_FINANCIAL_FIELDS)
  const hasAnySignal = [...CORE_FINANCIAL_FIELDS, ...EXTENDED_FINANCIAL_FIELDS, ...OPTIONAL_FINANCIAL_FIELDS].some(
    (field) => isFinancialFieldPopulated(field, mergedPayload),
  )
  if (!hasAnySignal) {
    return {
      ok: false,
      ticker: normalizedTicker,
      provider: "eodhd",
      error: providerResult.ok
        ? "Unable to build financial snapshot"
        : `${providerResult.error}; web enrichment did not return usable fields`,
    }
  }

  coverage._metrics = {
    coreFilled: coreCoverage.filled,
    coreTotal: coreCoverage.total,
    extendedFilled: extendedCoverage.filled,
    extendedTotal: extendedCoverage.total,
    sonarFallbackUsed,
  }
  coverage._provenance = mergedProvenance

  return {
    ok: true,
    ticker: normalizedTicker,
    provider: "eodhd",
    asOf: nowIso,
    payload: mergedPayload,
    coverage,
    provenance: mergedProvenance,
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

  const financialSnapshots = createAdminFinancialSnapshotRepository()

  const built =
    source === "web"
      ? await buildBraveWebSnapshotPayload({
          ticker: normalizedTicker,
          missingFields: [...CORE_FINANCIAL_FIELDS, ...EXTENDED_FINANCIAL_FIELDS],
        })
      : isHybridRefreshEnabled()
        ? await buildHybridSnapshotPayload(normalizedTicker)
        : await buildEodhdSnapshotPayload(normalizedTicker)
  if (!built.ok) {
    return { ok: false, ticker: normalizedTicker, error: built.error }
  }

  let payloadToPersist = { ...built.payload }
  const coverageToPersist = { ...(built.coverage ?? {}) }

  if (source === "web") {
    const existingSnapshot =
      await financialSnapshots.getPayloadAndCoverageByTicker(normalizedTicker)

    const existingPayload = coerceSnapshotPayload(
      (existingSnapshot?.payload ?? {}) as Partial<FinancialSnapshotPayload>,
    )
    payloadToPersist = mergeSnapshotPayloadNoRegression(
      existingPayload,
      payloadToPersist,
    )
    const rebuiltCoverage = buildCoverageFromPayload(payloadToPersist)
    const persistedStatusFields: FinancialMetricKey[] = [
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
      "insiderActivity30d",
      "nextEarningsDate",
      "recentTargetChanges",
      "indexChanges",
    ]
    for (const field of persistedStatusFields) {
      coverageToPersist[field] = rebuiltCoverage[field]
    }
  }

  if (!coverageToPersist._metrics) {
    const coreCoverage = countFilledMetrics(payloadToPersist, CORE_FINANCIAL_FIELDS)
    const extendedCoverage = countFilledMetrics(payloadToPersist, EXTENDED_FINANCIAL_FIELDS)
    coverageToPersist._metrics = {
      coreFilled: coreCoverage.filled,
      coreTotal: coreCoverage.total,
      extendedFilled: extendedCoverage.filled,
      extendedTotal: extendedCoverage.total,
      sonarFallbackUsed: false,
    }
  }
  if (!coverageToPersist._provenance && built.provenance) {
    coverageToPersist._provenance = built.provenance
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

  try {
    await financialSnapshots.upsert(row)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to persist snapshot"
    return { ok: false, ticker: normalizedTicker, error: message }
  }

  const metrics = coverageToPersist._metrics
  if (metrics) {
    const coreFillRate = metrics.coreTotal > 0 ? Number((metrics.coreFilled / metrics.coreTotal).toFixed(3)) : 0
    console.log("[financial/refresh] COVERAGE", {
      ticker: normalizedTicker,
      source,
      coreFillRate,
      coreFilled: metrics.coreFilled,
      coreTotal: metrics.coreTotal,
      extendedFilled: metrics.extendedFilled,
      extendedTotal: metrics.extendedTotal,
      sonarFallbackUsed: metrics.sonarFallbackUsed,
    })
  }

  return { ok: true, ticker: normalizedTicker, staleAfter: row.stale_after ?? "" }
}

export {}

