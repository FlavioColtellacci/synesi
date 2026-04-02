import { NextResponse } from "next/server"
import { createLlm, getTextModel } from "@/lib/llm"
import { getWebResearchContext } from "@/lib/web-research"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type Thesis = Database["public"]["Tables"]["theses"]["Row"]
type Assumption = Database["public"]["Tables"]["assumptions"]["Row"]
type AnalysisSection = { summary: string; points: string[] }
type AnalysisResponse = {
  clarityCheck: AnalysisSection
  stressTest: AnalysisSection
  biasScan: AnalysisSection
  monitoringPlan: AnalysisSection
  researchQuestions: AnalysisSection
  footer: string
}

function extractFirstJsonObject(input: string): string | null {
  const start = input.indexOf("{")
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < input.length; index += 1) {
    const char = input[index]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === "\\") {
        escaped = true
        continue
      }
      if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === "{") depth += 1
    if (char === "}") {
      depth -= 1
      if (depth === 0) return input.slice(start, index + 1)
    }
  }
  return null
}

function parseJsonResponse(rawText: string): Record<string, unknown> {
  const raw = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()
  const candidate = extractFirstJsonObject(raw) ?? raw
  return JSON.parse(candidate) as Record<string, unknown>
}

function sanitizeSection(input: unknown): AnalysisSection {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  const summaryRaw = typeof record.summary === "string" ? record.summary.replace(/\s+/g, " ").trim() : ""
  const pointsRaw = Array.isArray(record.points) ? record.points : []
  const points = pointsRaw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 0)
    .slice(0, 6)

  return {
    summary: summaryRaw.slice(0, 380),
    points,
  }
}

function sanitizeAnalysisPayload(parsed: Record<string, unknown>): AnalysisResponse {
  const output: AnalysisResponse = {
    clarityCheck: sanitizeSection(parsed.clarityCheck),
    stressTest: sanitizeSection(parsed.stressTest),
    biasScan: sanitizeSection(parsed.biasScan),
    monitoringPlan: sanitizeSection(parsed.monitoringPlan),
    researchQuestions: sanitizeSection(parsed.researchQuestions),
    footer:
      typeof parsed.footer === "string"
        ? parsed.footer.replace(/\s+/g, " ").trim().slice(0, 220)
        : "This analysis is not financial advice. It is a thinking tool to help you stress-test your own reasoning.",
  }

  const sectionKeys: Array<keyof Omit<AnalysisResponse, "footer">> = [
    "clarityCheck",
    "stressTest",
    "biasScan",
    "monitoringPlan",
    "researchQuestions",
  ]
  for (const key of sectionKeys) {
    if (!output[key].summary || output[key].points.length < 3) {
      throw new Error(`Invalid analysis payload: section ${key} is incomplete`)
    }
  }

  return output
}

async function buildDocumentEvidencePack(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  thesisId: string,
) {
  const [sourceMatchesResult, uploadsResult] = await Promise.all([
    supabase
      .from("thesis_source_matches")
      .select("match_reason,confidence,relevance_score,source_documents(title,source_name,content_excerpt)")
      .eq("user_id", userId)
      .eq("thesis_id", thesisId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("chat_uploaded_documents")
      .select("file_name,extracted_text,metadata")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  const lines: string[] = []
  let evidenceIndex = 1

  for (const row of sourceMatchesResult.data ?? []) {
    const sourceDocument = row.source_documents as
      | { title?: string | null; source_name?: string | null; content_excerpt?: string | null }
      | null
    const sourceName = sourceDocument?.source_name?.trim() || "Source"
    const title = sourceDocument?.title?.trim() || "Untitled document"
    const reason = typeof row.match_reason === "string" ? row.match_reason.replace(/\s+/g, " ").trim() : ""
    const excerpt =
      typeof sourceDocument?.content_excerpt === "string"
        ? sourceDocument.content_excerpt.replace(/\s+/g, " ").trim().slice(0, 220)
        : ""
    const confidence = typeof row.confidence === "string" ? row.confidence : "unknown"
    const relevance = typeof row.relevance_score === "number" ? row.relevance_score.toFixed(2) : "n/a"

    lines.push(
      `E${evidenceIndex}: [MatchedDoc] ${sourceName} - ${title} | reason=${reason || "not captured"} | confidence=${confidence}, relevance=${relevance}${excerpt ? ` | excerpt=${excerpt}` : ""}`,
    )
    evidenceIndex += 1
    if (evidenceIndex > 6) break
  }

  const uploads = (uploadsResult.data ?? [])
    .filter((row) => {
      const metadata = row.metadata
      if (!metadata || typeof metadata !== "object") return true
      const thesisMetadataId =
        "thesisId" in metadata && typeof metadata.thesisId === "string" ? metadata.thesisId.trim() : ""
      if (!thesisMetadataId) return true
      return thesisMetadataId === thesisId
    })
    .slice(0, 3)

  for (const row of uploads) {
    if (evidenceIndex > 8) break
    const excerpt =
      typeof row.extracted_text === "string"
        ? row.extracted_text.replace(/\s+/g, " ").trim().slice(0, 220)
        : ""
    if (!excerpt) continue
    const fileName = typeof row.file_name === "string" ? row.file_name.trim() : "uploaded-document"
    lines.push(`E${evidenceIndex}: [Upload] ${fileName} | excerpt=${excerpt}`)
    evidenceIndex += 1
  }

  return lines
}

function buildUserPrompt(
  thesis: Thesis,
  assumptions: Assumption[],
  evidenceLines: string[],
  highDepthMode: boolean,
) {
  return `Analyse this investment thesis and return a JSON object with exactly 6 keys: clarityCheck, stressTest, biasScan, monitoringPlan, researchQuestions, footer.

Each key should have this shape:
{ summary: string, points: string[] }
Where summary is 1-2 sentences and points is an array of 3-5 specific bullet points.

Guidelines per section:
- clarityCheck: Is the thesis specific, internally consistent, and falsifiable? Flag vague or unmeasurable elements.
- stressTest: For each assumption, what could realistically break it? What is the downstream impact on the thesis?
- biasScan: Identify overconfidence, confirmation bias, anchoring, or one-sided thinking in the investor's own language.
- monitoringPlan: For each assumption, suggest a specific KPI and a review moment (e.g. next earnings, quarterly check).
- researchQuestions: 3-5 specific questions this investor should research to stress-test or strengthen the thesis.
- If evidence lines are provided, cite concrete evidence tags (e.g. [E2]) in points where relevant. Do not fabricate tags.

Never give buy/sell advice. Never predict prices. Always reference the investor's own words. Add a footer key:
footer: 'This analysis is not financial advice. It is a thinking tool to help you stress-test your own reasoning.'
${highDepthMode ? "\nHigh-depth mode is ON: apply adversarial thinking, surface strongest counter-evidence, and pressure-test every fragile assumption." : ""}

THESIS DATA:
Stock: ${thesis.ticker}, ${thesis.company_name}
Thesis statement: ${thesis.thesis_statement}
Investing style: ${thesis.investing_style ?? "Not provided"}
Confidence: ${thesis.confidence_level}
Bull case: ${thesis.bull_case || "Not provided"}
Bear case: ${thesis.bear_case || "Not provided"}
Exit criteria: ${thesis.exit_criteria || "Not provided"}

Assumptions:
${assumptions
  .map(
    (a, i) => `
${i + 1}. [${a.category}] ${a.statement}
Break condition: ${a.break_condition || "Not specified"}
`,
  )
  .join("")}

EVIDENCE SNIPPETS:
${evidenceLines.length > 0 ? evidenceLines.join("\n") : "- none"}
`
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      thesisId?: string
      useRealTimeData?: boolean
      highDepthMode?: boolean
    }
    const thesisId = body.thesisId?.trim()
    const useRealTimeData = Boolean(body.useRealTimeData)
    const highDepthMode = Boolean(body.highDepthMode)

    if (!thesisId) {
      return NextResponse.json({ error: "Missing thesisId" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const llm = createLlm()

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existingAnalyses } = await supabase
      .from("thesis_updates")
      .select("id")
      .eq("thesis_id", thesisId)
      .eq("user_id", user.id)
      .eq("update_type", "ai_analysis")
      .gt("created_at", last24Hours)
      .limit(1)

    if ((existingAnalyses ?? []).length > 0) {
      return NextResponse.json(
        { error: "Analysis already run in the last 24 hours" },
        { status: 429 },
      )
    }

    const { data: thesis } = await supabase
      .from("theses")
      .select("*")
      .eq("id", thesisId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    const { data: assumptionsData } = await supabase
      .from("assumptions")
      .select("*")
      .eq("thesis_id", thesisId)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })

    const assumptions = assumptionsData ?? []
    const evidenceLines = await buildDocumentEvidencePack(supabase, user.id, thesisId)
    const userPrompt = buildUserPrompt(thesis, assumptions, evidenceLines, highDepthMode)

    let researchBlock = ""
    if (useRealTimeData) {
      const research = await getWebResearchContext({
        focus: "company",
        query: `Gather fresh, relevant public context to help stress-test an investment thesis for ${thesis.ticker} (${thesis.company_name}). Include: recent notable news (last 30-90 days), major product/strategy updates, competitive landscape, key risks, and any obvious factual corrections.\n\nThesis statement:\n${thesis.thesis_statement}\n\nAssumptions:\n${assumptions
          .map((a) => `- [${a.category}] ${a.statement} (break: ${a.break_condition || "n/a"})`)
          .join("\n")}`,
      })

      researchBlock = research.ok
        ? `\n\nFRESH RESEARCH CONTEXT (from web-connected research; may be incomplete):\n${research.content}\n${
            research.citations.length
              ? `\nSources:\n${research.citations.map((url) => `- ${url}`).join("\n")}\n`
              : ""
          }`
        : "\n\nFRESH RESEARCH CONTEXT: (unavailable)\n"
    }

    const requestPayload = {
      max_tokens: 4000,
      system:
        "You are a rigorous thinking partner helping a long-term investor stress-test their investment thesis. Your job is NOT to give investment advice or predict stock performance. Your job is to help the investor think more clearly about their own reasoning. Always respond with valid JSON only. No explanation, no markdown.",
      messages: [{ role: "user" as const, content: `${userPrompt}${researchBlock}` }],
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

    const firstPassParsed = parseJsonResponse(responseText)

    let finalParsed = firstPassParsed
    if (highDepthMode) {
      const critiquePrompt = `You are an adversarial reviewer. Improve the draft analysis by stress-testing weak logic and unsupported claims.
Return valid JSON only with the exact same keys: clarityCheck, stressTest, biasScan, monitoringPlan, researchQuestions, footer.
Rules:
- Keep all output grounded in thesis data and any provided evidence lines.
- If evidence tags are used, only use tags that exist in the evidence list (E1, E2, ...).
- Keep each section actionable and specific.

THESIS:
- ticker=${thesis.ticker}
- company=${thesis.company_name}
- thesis=${thesis.thesis_statement}

ASSUMPTIONS:
${assumptions.map((a) => `- [${a.category}] ${a.statement} | break=${a.break_condition || "n/a"}`).join("\n")}

EVIDENCE:
${evidenceLines.length > 0 ? evidenceLines.join("\n") : "- none"}

FIRST PASS JSON:
${JSON.stringify(firstPassParsed)}`

      const secondPass = await llm.messages.create({
        model: getTextModel(),
        max_tokens: 4200,
        system:
          "You are a rigorous red-team analyst improving investment-thesis reasoning quality. JSON only; no markdown.",
        messages: [{ role: "user", content: critiquePrompt }],
      })

      const secondPassText = secondPass.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim()
      finalParsed = parseJsonResponse(secondPassText)
    }

    const analysis = sanitizeAnalysisPayload(finalParsed)

    const { data: insertedUpdate, error: insertError } = await supabase
      .from("thesis_updates")
      .insert({
        thesis_id: thesisId,
        user_id: user.id,
        update_type: "ai_analysis",
        note: JSON.stringify(analysis),
      })
      .select("created_at")
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ analysis, analysedAt: insertedUpdate.created_at })
  } catch (error) {
    console.error("Analysis failed:", error)
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
  }
}
