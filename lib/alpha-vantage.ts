// Server-only, do not import in client components

export type PriceChangeResult =
  | { ok: true; ticker: string; changePercent: number; latestTradingDay: string }
  | { ok: false; ticker: string; error: string }

export type GlobalQuotePriceResult =
  | { ok: true; ticker: string; price: number }
  | { ok: false; ticker: string; error: string }

function getApiKey() {
  return process.env.ALPHA_VANTAGE_API_KEY?.trim()
}

export async function getDailyPriceChange(ticker: string): Promise<PriceChangeResult> {
  const apiKey = getApiKey()

  if (!apiKey) {
    return { ok: false, ticker, error: "ALPHA_VANTAGE_API_KEY is not set" }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    const endpoint = new URL("https://www.alphavantage.co/query")
    endpoint.searchParams.set("function", "GLOBAL_QUOTE")
    endpoint.searchParams.set("symbol", ticker)
    endpoint.searchParams.set("apikey", apiKey)

    const response = await fetch(endpoint.toString(), {
      method: "GET",
      signal: controller.signal,
    })
    const data = (await response.json()) as Record<string, Record<string, string>>
    const quote = data["Global Quote"]
    const rawChangePercent = quote?.["10. change percent"]?.replace("%", "").trim()
    const parsedChangePercent = rawChangePercent ? Number.parseFloat(rawChangePercent) : Number.NaN

    if (!quote || Object.keys(quote).length === 0 || Number.isNaN(parsedChangePercent)) {
      return {
        ok: false,
        ticker,
        error: "No data returned, ticker may be invalid or market is closed",
      }
    }

    return {
      ok: true,
      ticker,
      changePercent: parsedChangePercent,
      latestTradingDay: quote["07. latest trading day"],
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, ticker, error: `Fetch failed: ${message}` }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function getGlobalQuotePrice(ticker: string): Promise<GlobalQuotePriceResult> {
  const apiKey = getApiKey()

  if (!apiKey) {
    return { ok: false, ticker, error: "ALPHA_VANTAGE_API_KEY is not set" }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    const endpoint = new URL("https://www.alphavantage.co/query")
    endpoint.searchParams.set("function", "GLOBAL_QUOTE")
    endpoint.searchParams.set("symbol", ticker)
    endpoint.searchParams.set("apikey", apiKey)

    const response = await fetch(endpoint.toString(), {
      method: "GET",
      signal: controller.signal,
    })
    const data = (await response.json()) as Record<string, Record<string, string>>
    const quote = data["Global Quote"]
    const rawPrice = quote?.["05. price"]?.trim()
    const parsedPrice = rawPrice ? Number.parseFloat(rawPrice) : Number.NaN

    if (!quote || Object.keys(quote).length === 0 || Number.isNaN(parsedPrice)) {
      return {
        ok: false,
        ticker,
        error: "No quote price returned from Alpha Vantage",
      }
    }

    return { ok: true, ticker, price: parsedPrice }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, ticker, error: `Fetch failed: ${message}` }
  } finally {
    clearTimeout(timeoutId)
  }
}
export {}
