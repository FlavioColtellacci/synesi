import { NextResponse } from "next/server"
import { createLlm, getTextModel, type LlmProvider } from "@/lib/llm"
import { getPerplexityResearchContext } from "@/lib/perplexity"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type Thesis = Database["public"]["Tables"]["theses"]["Row"]
type Assumption = Database["public"]["Tables"]["assumptions"]["Row"]

function getProviderForUser(profile: {
  subscription_status: string
  trial_ends_at: string | null
} | null): LlmProvider {
  if (profile?.subscription_status === "active") {
    return "anthropic"
  }

  if (profile?.trial_ends_at && new Date(profile.trial_ends_at).getTime() > Date.now()) {
    return "minimax"
  }

  return "anthropic"
}

function isModelNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return message.includes("not_found_error") || message.includes("model:")
}

function buildUserPrompt(thesis: Thesis, assumptions: Assumption[]) {
  return `Analyse this investment thesis and return a JSON object with exactly 5 keys: clarityCheck, stressTest, biasScan, monitoringPlan, researchQuestions.

Each key should have this shape:
{ summary: string, points: string[] }
Where summary is 1-2 sentences and points is an array of 3-5 specific bullet points.

Guidelines per section:
- clarityCheck: Is the thesis specific, internally consistent, and falsifiable? Flag vague or unmeasurable elements.
- stressTest: For each assumption, what could realistically break it? What is the downstream impact on the thesis?
- biasScan: Identify overconfidence, confirmation bias, anchoring, or one-sided thinking in the investor's own language.
- monitoringPlan: For each assumption, suggest a specific KPI and a review moment (e.g. next earnings, quarterly check).
- researchQuestions: 3-5 specific questions this investor should research to stress-test or strengthen the thesis.

Never give buy/sell advice. Never predict prices. Always reference the investor's own words. Add a footer key:
footer: 'This analysis is not financial advice. It is a thinking tool to help you stress-test your own reasoning.'

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
`
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      thesisId?: string
      useRealTimeData?: boolean
    }
    const thesisId = body.thesisId?.trim()
    const useRealTimeData = Boolean(body.useRealTimeData)

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, trial_ends_at")
      .eq("id", user.id)
      .maybeSingle()

    const provider = getProviderForUser(profile)
    const llm = createLlm(provider)

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
    const userPrompt = buildUserPrompt(thesis, assumptions)

    let researchBlock = ""
    if (useRealTimeData) {
      const research = await getPerplexityResearchContext({
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
      messages: [{ role: "user", content: `${userPrompt}${researchBlock}` }],
    } as const

    let completion: Awaited<ReturnType<typeof llm.messages.create>>
    try {
      completion = await llm.messages.create({
        model: getTextModel(provider),
        ...requestPayload,
      })
    } catch (error: unknown) {
      if (provider === "minimax" && isModelNotFoundError(error)) {
        const fallbackLlm = createLlm("anthropic")
        completion = await fallbackLlm.messages.create({
          model: getTextModel("anthropic"),
          ...requestPayload,
        })
      } else {
        throw error
      }
    }

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

    const analysis = JSON.parse(raw)

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
