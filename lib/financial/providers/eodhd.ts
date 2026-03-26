// Server-only, do not import in client components

type EodhdConfig = {
  apiKey: string
  baseUrl: string
}

function getEodhdConfig(): EodhdConfig {
  const apiKey = process.env.EODHD_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("EODHD_API_KEY is not set")
  }

  return {
    apiKey,
    baseUrl: "https://eodhd.com/api",
  }
}

function toEodhdSymbol(ticker: string): string {
  const normalized = ticker.trim().toUpperCase()
  // EODHD commonly uses SYMBOL.EXCHANGE, e.g. AAPL.US.
  // Default to US if no exchange provided.
  return normalized.includes(".") ? normalized : `${normalized}.US`
}

async function fetchJson<T>(url: URL, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        // EODHD uses query param auth; keep headers minimal.
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`EODHD request failed (${response.status}): ${text || response.statusText}`)
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timeoutId)
  }
}

// --- Endpoints ---

export type EodhdRealTimeQuote = {
  code?: string
  close?: number
  timestamp?: number
  // many other fields exist; we only map what we need
}

export async function getRealTimeQuote(ticker: string): Promise<EodhdRealTimeQuote> {
  const { apiKey, baseUrl } = getEodhdConfig()
  const symbol = toEodhdSymbol(ticker)
  const url = new URL(`${baseUrl}/real-time/${encodeURIComponent(symbol)}`)
  url.searchParams.set("api_token", apiKey)
  url.searchParams.set("fmt", "json")
  return await fetchJson<EodhdRealTimeQuote>(url, 10_000)
}

export type EodhdFundamentals = Record<string, unknown>

export async function getFundamentals(ticker: string): Promise<EodhdFundamentals> {
  const { apiKey, baseUrl } = getEodhdConfig()
  const symbol = toEodhdSymbol(ticker)
  const url = new URL(`${baseUrl}/fundamentals/${encodeURIComponent(symbol)}`)
  url.searchParams.set("api_token", apiKey)
  url.searchParams.set("fmt", "json")
  return await fetchJson<EodhdFundamentals>(url, 12_000)
}

// The technical endpoint supports filter=last_rsi to fetch only the last value.
export type EodhdLastRsiResponse = number | { last_rsi?: number } | Record<string, unknown>

export async function getLastRsi14(ticker: string): Promise<number | null> {
  const { apiKey, baseUrl } = getEodhdConfig()
  const symbol = toEodhdSymbol(ticker)
  const url = new URL(`${baseUrl}/technical/${encodeURIComponent(symbol)}`)
  url.searchParams.set("api_token", apiKey)
  url.searchParams.set("fmt", "json")
  url.searchParams.set("function", "rsi")
  url.searchParams.set("period", "14")
  url.searchParams.set("filter", "last_rsi")

  const data = await fetchJson<EodhdLastRsiResponse>(url, 12_000)

  if (typeof data === "number") {
    return Number.isFinite(data) ? data : null
  }

  if (data && typeof data === "object" && "last_rsi" in data) {
    const value = (data as { last_rsi?: unknown }).last_rsi
    return typeof value === "number" && Number.isFinite(value) ? value : null
  }

  return null
}

export type EodhdInsiderTransaction = {
  transaction_date?: string
  transaction_code?: string // "P" | "S" typically
  securities_transacted?: string | number
  // many other fields
}

export async function getInsiderTransactions(params: {
  ticker: string
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
  limit?: number
}): Promise<EodhdInsiderTransaction[]> {
  const { apiKey, baseUrl } = getEodhdConfig()
  const symbol = toEodhdSymbol(params.ticker)
  const url = new URL(`${baseUrl}/insider-transactions`)
  url.searchParams.set("api_token", apiKey)
  url.searchParams.set("fmt", "json")
  url.searchParams.set("code", symbol)
  url.searchParams.set("from", params.from)
  url.searchParams.set("to", params.to)
  url.searchParams.set("limit", String(params.limit ?? 200))
  return await fetchJson<EodhdInsiderTransaction[]>(url, 12_000)
}

export type EodhdEarningsCalendarItem = {
  code?: string
  report_date?: string // YYYY-MM-DD
  // may contain time/before-after market etc.
}

export async function getEarningsCalendar(params: {
  tickers: string[]
  from?: string
  to?: string
}): Promise<EodhdEarningsCalendarItem[]> {
  const { apiKey, baseUrl } = getEodhdConfig()
  const symbols = params.tickers.map(toEodhdSymbol)
  const url = new URL(`${baseUrl}/calendar/earnings`)
  url.searchParams.set("api_token", apiKey)
  url.searchParams.set("fmt", "json")
  url.searchParams.set("symbols", symbols.join(","))
  if (params.from) url.searchParams.set("from", params.from)
  if (params.to) url.searchParams.set("to", params.to)
  return await fetchJson<EodhdEarningsCalendarItem[]>(url, 12_000)
}

export {}

