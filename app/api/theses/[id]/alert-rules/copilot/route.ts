import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createLlm, getTextModel } from "@/lib/llm"

const VALID_MODES = ["only_sources", "include_sources", "exclude_sources"] as const
const VALID_MIN_CONFIDENCE = ["high", "medium"] as const
const VALID_SOURCE_TYPES = ["analyst", "news_outlet", "newsletter", "sec_filing", "other"] as const

type Mode = (typeof VALID_MODES)[number]
type MinConfidence = (typeof VALID_MIN_CONFIDENCE)[number]
type SourceType = (typeof VALID_SOURCE_TYPES)[number]

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: thesisId } = await params
    const body = (await request.json()) as { intent?: unknown }
    const intent = typeof body.intent === "string" ? body.intent.trim() : ""

    if (!intent) {
      return NextResponse.json({ error: "Missing intent" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: thesis } = await supabase
      .from("theses")
      .select("id, user_id, ticker, company_name, thesis_statement")
      .eq("id", thesisId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    const { data: existingSources } = await supabase
      .from("trusted_sources")
      .select("name, url, source_type")
      .eq("thesis_id", thesisId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    const system = `You help set up deterministic, rule-based thesis challenge alerts.\n\nReturn VALID JSON ONLY (no markdown), matching this exact shape:\n{\n  \"recommendedMode\": \"only_sources\" | \"include_sources\" | \"exclude_sources\",\n  \"recommendedMinConfidence\": \"high\" | \"medium\",\n  \"includeKeywords\": string[],\n  \"excludeKeywords\": string[],\n  \"sources\": Array<{\n    \"sourceType\": \"analyst\" | \"news_outlet\" | \"newsletter\" | \"sec_filing\" | \"other\",\n    \"nameCandidates\": string[],\n    \"urlCandidates\": string[]\n  }>\n}\n\nRules:\n- Provide 1-5 sources.\n- urlCandidates should prefer RSS/Atom feed URLs or feed-like search URLs (not generic homepages).\n- includeKeywords/excludeKeywords should be short (1-3 words each) and lowercase-friendly.\n- Be conservative: if unsure, leave lists empty.\n`

    const userPrompt = `THESIS:\nTicker: ${thesis.ticker}\nCompany: ${thesis.company_name}\nThesis statement: ${thesis.thesis_statement}\n\nEXISTING TRUSTED SOURCES (already saved):\n${(existingSources ?? [])
      .map((s) => `- ${s.name} (${s.source_type}) ${s.url ?? ""}`.trim())
      .join("\n")}\n\nUSER INTENT:\n${intent}\n`

    const llm = createLlm()
    const requestPayload = {
      max_tokens: 1400,
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

    const raw = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim()

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
        const urlCandidates = cleanStringArray(item.urlCandidates, 6)
        return {
          sourceType: toSourceType(item.sourceType),
          nameCandidates: cleanStringArray(item.nameCandidates, 4),
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
    })
  } catch (error) {
    console.error("Alert rule copilot failed:", error)
    return NextResponse.json({ error: "Copilot failed" }, { status: 500 })
  }
}

