// Server-only, do not import in client components
// Brave Search retrieval for MiniMax and other synthesis steps (no Perplexity).

type ResearchFocus = "markets" | "company" | "thesis"

type BraveWebSearchResponse = {
  web?: {
    results?: Array<{
      title?: string
      url?: string
      description?: string
      age?: string
      page_age?: string
    }>
  }
}

export type WebResearchResult =
  | { ok: true; content: string; citations: string[] }
  | { ok: false; error: string }

function truncate(input: string, maxChars: number) {
  if (input.length <= maxChars) return input
  return `${input.slice(0, maxChars)}\n\n[truncated]`
}

function getFocusHint(focus: ResearchFocus) {
  if (focus === "markets") {
    return "Focus on macro, sector movement, rates, and broad market context from recent months."
  }
  if (focus === "company") {
    return "Focus on company news, earnings updates, product strategy, and competitive context from recent months."
  }
  return "Focus on thesis-relevant context, factual checks, and key risks from recent months."
}

type BraveWebHit = NonNullable<NonNullable<BraveWebSearchResponse["web"]>["results"]>[number]

function buildResearchContent(query: string, focus: ResearchFocus, results: BraveWebHit[]) {
  const lines = [
    `WEB RESEARCH SNAPSHOT (${focus.toUpperCase()})`,
    `Query: ${truncate(query, 1_000)}`,
    "",
    "Top findings:",
  ]

  for (const [index, result] of results.entries()) {
    const title = result.title?.trim() || "Untitled result"
    const url = result.url?.trim() || ""
    const description = result.description?.replace(/\s+/g, " ").trim() || "No snippet available."
    const age = result.age?.trim() || result.page_age?.trim() || "date unknown"

    lines.push(`${index + 1}. ${title}`)
    if (url) lines.push(`   URL: ${url}`)
    lines.push(`   Age: ${age}`)
    lines.push(`   Snippet: ${description}`)
  }

  lines.push("")
  lines.push(`Use this web context to support ${focus} analysis. ${getFocusHint(focus)}`)
  return truncate(lines.join("\n"), 8_000)
}

export async function getWebResearchContext(params: {
  query: string
  focus?: ResearchFocus
  model?: string
}): Promise<WebResearchResult> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim()

  if (!apiKey) {
    return { ok: false, error: "BRAVE_SEARCH_API_KEY is not set" }
  }

  const query = params.query.trim()
  if (!query) {
    return { ok: false, error: "Query is empty" }
  }

  const focus = params.focus ?? "thesis"
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12_000)

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search")
    url.searchParams.set("q", `${truncate(query, 4_000)}\n\n${getFocusHint(focus)}`)
    url.searchParams.set("count", "10")
    url.searchParams.set("search_lang", "en")
    url.searchParams.set("country", "us")
    url.searchParams.set("safesearch", "moderate")

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = (await response.text().catch(() => "")).trim()
      return {
        ok: false,
        error: `Brave request failed (${response.status}): ${text || response.statusText}`,
      }
    }

    const data = (await response.json()) as BraveWebSearchResponse
    const results = (data.web?.results ?? []).filter((item) => typeof item.url === "string" && item.url.length > 0)

    if (results.length === 0) {
      return { ok: false, error: "Brave returned no web results" }
    }

    const citations = Array.from(new Set(results.map((item) => item.url!.trim()).filter(Boolean))).slice(0, 15)

    return {
      ok: true,
      content: buildResearchContent(query, focus, results.slice(0, 10)),
      citations,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Brave fetch failed: ${message}` }
  } finally {
    clearTimeout(timeoutId)
  }
}
