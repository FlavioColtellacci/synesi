import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import {
  getOwnedThesis as getOwnedFirebaseThesis,
  listTrustedSourcesByThesis as listFirebaseTrustedSourcesByThesis,
} from "@/lib/firebase/alerting"
import { createClient } from "@/lib/supabase/server"
import { createLlm, getTextModel } from "@/lib/llm"
import { getWebResearchContext } from "@/lib/web-research"

const VALID_MODES = ["only_sources", "include_sources", "exclude_sources"] as const
const VALID_MIN_CONFIDENCE = ["high", "medium"] as const
const VALID_SOURCE_TYPES = ["analyst", "news_outlet", "newsletter", "sec_filing", "other"] as const

type Mode = (typeof VALID_MODES)[number]
type MinConfidence = (typeof VALID_MIN_CONFIDENCE)[number]
type SourceType = (typeof VALID_SOURCE_TYPES)[number]

function extractFirstJsonObject(value: string): string | null {
  const text = value.trim()
  if (!text) return null
  const fenced = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()
  if (fenced.startsWith("{") && fenced.endsWith("}")) {
    return fenced
  }

  const start = fenced.indexOf("{")
  if (start === -1) return null

  let depth = 0
  let inString = false
  let isEscaped = false

  for (let i = start; i < fenced.length; i++) {
    const char = fenced[i]

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
        return fenced.slice(start, i + 1).trim()
      }
    }
  }

  return null
}

function toApiErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ""
  const lower = message.toLowerCase()
  if (lower.includes("api key") || lower.includes("authentication") || lower.includes("unauthorized")) {
    return "Copilot provider authentication failed. Check your LLM API configuration."
  }
  if (error instanceof SyntaxError || lower.includes("json")) {
    return "Copilot returned an invalid format. Please try again."
  }
  if (message) {
    return message
  }
  return "Copilot failed"
}

function looksLikeFeedUrl(value: string) {
  const input = value.trim().toLowerCase()
  if (!input) return false
  return (
    input.includes("/rss") ||
    input.includes("rss.") ||
    input.includes("/feed") ||
    input.includes("atom") ||
    input.endsWith(".xml") ||
    input.includes("news.google.com/rss")
  )
}

function cleanStringArray(value: unknown, maxItems = 8): string[] {
  if (!Array.isArray(value)) return []
  const cleaned = value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
  return [...new Set(cleaned)].slice(0, maxItems)
}

function normalizeIntent(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 2000)
}

function buildBraveQueries(intent: string, ticker: string, company: string): string[] {
  const t = ticker.trim()
  const c = company.trim()
  const base = [intent, t, c].filter(Boolean).join(" ").trim()
  return [
    `${base} RSS feed OR atom feed OR xml feed`.trim(),
    `${base} site:news.google.com OR site:feeds OR inurl:rss OR inurl:feed`.trim(),
  ].filter((q) => q.length > 0)
}

async function gatherBraveContextForAlerts(intent: string, ticker: string, company: string) {
  const queries = buildBraveQueries(intent, ticker, company)
  const results = await Promise.all(
    queries.map((query) => getWebResearchContext({ query, focus: "company" })),
  )

  const chunks: string[] = []
  const citationSet = new Set<string>()
  let anyOk = false

  for (const r of results) {
    if (r.ok) {
      anyOk = true
      chunks.push(r.content)
      for (const url of r.citations) {
        if (url) citationSet.add(url)
      }
    }
  }

  const citations = [...citationSet].slice(0, 25)
  const rawMergedBody =
    chunks.length > 0
      ? `${chunks.join("\n\n---\n\n")}\n\nUNIQUE URLS FROM RESULTS:\n${citations.map((u) => `- ${u}`).join("\n")}`
      : ""
  const maxBodyChars = 10_000
  const mergedBody =
    rawMergedBody.length > maxBodyChars
      ? `${rawMergedBody.slice(0, maxBodyChars)}\n\n[web research truncated for model context]`
      : rawMergedBody
  const merged =
    mergedBody.length > 0
      ? `WEB RESEARCH (merged queries; use URLs and titles below to pick real RSS/Atom feeds)\n\n${mergedBody}`
      : ""

  const errors = results.filter((r): r is { ok: false; error: string } => !r.ok).map((r) => r.error)
  return { merged, citations, anyOk, errors }
}

function toMode(value: unknown): Mode | null {
  return typeof value === "string" && (VALID_MODES as readonly string[]).includes(value) ? (value as Mode) : null
}

function toMinConfidence(value: unknown): MinConfidence | null {
  return typeof value === "string" && (VALID_MIN_CONFIDENCE as readonly string[]).includes(value)
    ? (value as MinConfidence)
    : null
}

function toSourceType(value: unknown): SourceType {
  if (typeof value === "string" && (VALID_SOURCE_TYPES as readonly string[]).includes(value)) {
    return value as SourceType
  }
  return "other"
}

function buildFallbackFeedUrls(input: {
  sourceType: SourceType
  nameCandidates: string[]
  thesisTicker: string
  thesisCompanyName: string
}): string[] {
  const urls: string[] = []
  const normalizedNames = input.nameCandidates.map((name) => name.trim().toLowerCase()).filter(Boolean)

  if (normalizedNames.some((name) => name.includes("reuters"))) {
    urls.push("http://live.reuters.com/api/feed/RSS_Recent.aspx")
  }
  if (normalizedNames.some((name) => name.includes("marketwatch"))) {
    urls.push("https://feeds.content.dowjones.io/public/rss/mw_topstories")
  }

  const ticker = input.thesisTicker.trim().toUpperCase()
  const company = input.thesisCompanyName.trim()
  const thesisQuery = encodeURIComponent([ticker, company].filter(Boolean).join(" OR "))
  if (thesisQuery) {
    urls.push(`https://news.google.com/rss/search?q=${thesisQuery}&hl=en-US&gl=US&ceid=US:en`)
  }

  const scopedNames = normalizedNames.slice(0, 2)
  for (const name of scopedNames) {
    const scopedQuery = encodeURIComponent([name, ticker].filter(Boolean).join(" "))
    if (scopedQuery) {
      urls.push(`https://news.google.com/rss/search?q=${scopedQuery}&hl=en-US&gl=US&ceid=US:en`)
    }
  }

  if (input.sourceType === "sec_filing" && ticker) {
    const secQuery = encodeURIComponent(`${ticker} sec filing`)
    urls.push(`https://news.google.com/rss/search?q=${secQuery}&hl=en-US&gl=US&ceid=US:en`)
  }

  return [...new Set(urls)].slice(0, 6)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: thesisId } = await params
    const body = (await request.json()) as { intent?: unknown }
    const rawIntent = typeof body.intent === "string" ? body.intent : ""
    const intent = normalizeIntent(rawIntent)

    if (!intent) {
      return NextResponse.json({ error: "Missing intent" }, { status: 400 })
    }

    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let thesis: { ticker: string; company_name: string; thesis_statement: string } | null = null
    let existingSources: Array<{ name: string; url: string | null; source_type: string }> = []

    if (isFirebaseBackend()) {
      const firestore = getFirebaseAdminFirestore()
      const firebaseThesis = await getOwnedFirebaseThesis(firestore, userId, thesisId)
      if (!firebaseThesis) {
        return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
      }
      thesis = {
        ticker: firebaseThesis.ticker ?? "",
        company_name: firebaseThesis.company_name ?? "",
        thesis_statement: firebaseThesis.thesis_statement ?? "",
      }
      const firebaseSources = await listFirebaseTrustedSourcesByThesis(firestore, userId, thesisId)
      existingSources = firebaseSources
        .slice()
        .reverse()
        .map((source) => ({
          name: source.name,
          url: source.url,
          source_type: source.source_type,
        }))
    } else {
      const supabase = await createClient()
      const { data: supabaseThesis } = await supabase
        .from("theses")
        .select("id, user_id, ticker, company_name, thesis_statement")
        .eq("id", thesisId)
        .eq("user_id", userId)
        .maybeSingle()

      if (!supabaseThesis) {
        return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
      }
      thesis = {
        ticker: supabaseThesis.ticker ?? "",
        company_name: supabaseThesis.company_name ?? "",
        thesis_statement: supabaseThesis.thesis_statement ?? "",
      }
      const { data: supabaseSources } = await supabase
        .from("trusted_sources")
        .select("name, url, source_type")
        .eq("thesis_id", thesisId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      existingSources = supabaseSources ?? []
    }

    const brave = await gatherBraveContextForAlerts(intent, thesis.ticker, thesis.company_name)

    const system = `You are Sigma (Synesi). You help set up deterministic personalized alerts for an investment thesis.\n\nReturn VALID JSON ONLY (no markdown), matching this exact shape:\n{\n  \"recommendedMode\": \"only_sources\" | \"include_sources\" | \"exclude_sources\",\n  \"recommendedMinConfidence\": \"high\" | \"medium\",\n  \"includeKeywords\": string[],\n  \"excludeKeywords\": string[],\n  \"sources\": Array<{\n    \"sourceType\": \"analyst\" | \"news_outlet\" | \"newsletter\" | \"sec_filing\" | \"other\",\n    \"nameCandidates\": string[],\n    \"urlCandidates\": string[]\n  }>\n}\n\nRules:\n- Provide 1-5 sources.\n- urlCandidates MUST be direct RSS/Atom or feed-like links only.\n- When WEB RESEARCH is included in the user message, STRONGLY PREFER urlCandidates that appear in that research (titles/snippets/URL list) and that look like feeds (rss, atom, /feed, .xml).\n- Never invent URLs. If web search did not surface a feed for an outlet, use empty urlCandidates for that source (downstream logic may add Google News RSS fallbacks).\n- Never output generic homepages, profile pages, or stock quote pages as urlCandidates.\n- includeKeywords/excludeKeywords should be short (1-3 words each) and lowercase-friendly.\n- Be conservative: if unsure, leave lists empty.\n`

    const braveSection = brave.merged
      ? `\n\n${brave.merged}\n`
      : "\n\n(No live web research available; rely on known feed patterns and conservative guesses; empty urlCandidates when uncertain.)\n"

    const userPrompt = `THESIS:\nTicker: ${thesis.ticker}\nCompany: ${thesis.company_name}\nThesis statement: ${thesis.thesis_statement}\n\nEXISTING TRUSTED SOURCES (already saved):\n${existingSources
      .map((s) => `- ${s.name} (${s.source_type}) ${s.url ?? ""}`.trim())
      .join("\n")}\n\nUSER INTENT (plain language):\n${intent}\n${braveSection}`

    const llm = createLlm()
    const requestPayload = {
      max_tokens: 2000,
      system,
      messages: [{ role: "user" as const, content: userPrompt }],
    }

    const completion = await llm.messages.create({
      model: getTextModel(),
      ...requestPayload,
    })

    const responseText = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim()

    const raw = extractFirstJsonObject(responseText)
    if (!raw) {
      throw new SyntaxError("No JSON object found in copilot response")
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>

    const recommendedMode = toMode(parsed.recommendedMode) ?? "only_sources"
    const recommendedMinConfidence = toMinConfidence(parsed.recommendedMinConfidence) ?? "high"
    const includeKeywords = cleanStringArray(parsed.includeKeywords, 12).map((k) => k.toLowerCase())
    const excludeKeywords = cleanStringArray(parsed.excludeKeywords, 12).map((k) => k.toLowerCase())

    const sourcesRaw = Array.isArray(parsed.sources) ? parsed.sources : []
    const sources = sourcesRaw
      .slice(0, 5)
      .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : {}))
      .map((item) => {
        const sourceType = toSourceType(item.sourceType)
        const nameCandidates = cleanStringArray(item.nameCandidates, 4)
        const explicitUrlCandidates = cleanStringArray(item.urlCandidates, 6).filter((candidate) => {
          try {
            return Boolean(new URL(candidate))
          } catch {
            return false
          }
        })
        const explicitFeedLikeCandidates = explicitUrlCandidates.filter((url) => looksLikeFeedUrl(url))
        const fallbackUrlCandidates =
          explicitFeedLikeCandidates.length > 0
            ? []
            : buildFallbackFeedUrls({
                sourceType,
                nameCandidates,
                thesisTicker: thesis.ticker,
                thesisCompanyName: thesis.company_name,
              })
        const rawCandidates = [...new Set([...explicitFeedLikeCandidates, ...fallbackUrlCandidates])]
        const feedLikeCandidates = rawCandidates.filter((url) => looksLikeFeedUrl(url))
        const urlCandidates = feedLikeCandidates.slice(0, 6)
        return {
          sourceType,
          nameCandidates,
          urlCandidates: urlCandidates.map((url) => ({
            url,
            isFeedLike: looksLikeFeedUrl(url),
          })),
        }
      })
      .filter((item) => item.nameCandidates.length > 0 || item.urlCandidates.length > 0)

    return NextResponse.json({
      suggestion: {
        recommendedMode,
        recommendedMinConfidence,
        includeKeywords,
        excludeKeywords,
        sources,
      },
      braveSearchUsed: brave.anyOk,
      braveSearchNote: brave.anyOk
        ? "Sigma proposed feeds from search results."
        : brave.errors[0]
          ? `Search unavailable (${brave.errors[0]}). Feeds may rely on fallbacks.`
          : "Search returned no usable results; feeds may rely on fallbacks.",
    })
  } catch (error) {
    console.error("Alert rule copilot failed:", error)
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 500 })
  }
}

