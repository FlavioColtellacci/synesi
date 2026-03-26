// Server-only, do not import in client components

type PerplexityChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string }
  }>
  citations?: string[]
}

export type PerplexityResearchResult =
  | { ok: true; content: string; citations: string[] }
  | { ok: false; error: string }

function truncate(input: string, maxChars: number) {
  if (input.length <= maxChars) return input
  return `${input.slice(0, maxChars)}\n\n[truncated]`
}

export async function getPerplexityResearchContext(params: {
  query: string
  focus?: "markets" | "company" | "thesis"
  model?: string
}): Promise<PerplexityResearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim()

  if (!apiKey) {
    return { ok: false, error: "PERPLEXITY_API_KEY is not set" }
  }

  const query = params.query.trim()
  if (!query) {
    return { ok: false, error: "Query is empty" }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12_000)

  try {
    const focus = params.focus ?? "thesis"
    const model = params.model?.trim() || "sonar-pro"
    const now = new Date().toISOString()
    const system = `You are a research assistant. Use web-connected retrieval.
Return a concise, factual research brief for ${focus}. Prefer the last 30-90 days.
Format as plain text with short sections and bullet points. Include 5-10 sources if available.`

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Date (UTC): ${now}\n\nResearch query:\n${truncate(query, 4_000)}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      return {
        ok: false,
        error: `Perplexity request failed (${response.status}): ${text || response.statusText}`,
      }
    }

    const data = (await response.json()) as PerplexityChatCompletionResponse
    const content =
      data.choices?.[0]?.message?.content?.trim() ??
      ""

    if (!content) {
      return { ok: false, error: "Perplexity returned empty content" }
    }

    return {
      ok: true,
      content: truncate(content, 8_000),
      citations: (data.citations ?? []).filter(Boolean).slice(0, 15),
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, error: `Perplexity fetch failed: ${message}` }
  } finally {
    clearTimeout(timeoutId)
  }
}

export {}
