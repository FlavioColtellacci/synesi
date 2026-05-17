import { NextResponse } from "next/server"
import { createLlm, getTextModel } from "@/lib/llm"
import { getWebResearchContext } from "@/lib/web-research"
import { getServerUserId } from "@/lib/data/auth"

type ExtractedThesis = {
  ticker: string
  companyName: string
  thesisStatement: string
  investingStyle: string
  assumptions: {
    category: string
    statement: string
    breakCondition: string
  }[]
  bullCase: string
  bearCase: string
  exitCriteria: string
  confidenceLevel: "high" | "medium" | "low"
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      rawInput?: string
      useRealTimeData?: boolean
    }
    const rawInput = body.rawInput?.trim() ?? ""
    const useRealTimeData = Boolean(body.useRealTimeData)

    if (!rawInput || rawInput.length < 50) {
      return NextResponse.json(
        { error: "rawInput must be at least 50 characters" },
        { status: 400 },
      )
    }

    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const llm = createLlm()

    let researchBlock = ""
    if (useRealTimeData) {
      const research = await getWebResearchContext({
        focus: "thesis",
        query: `The user is writing an investment thesis. Gather fresh, relevant public context to help analyse their input (company overview, recent notable news, key risks, competitive landscape, and any obvious factual corrections if the user mentions something inaccurate). User input:\n\n${rawInput}`,
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
      max_tokens: 2000,
      system:
        "You are a financial analyst assistant helping a long-term investor structure their investment thesis. Extract and structure the information from the user's input. Always respond with valid JSON only. No explanation, no markdown, just the JSON object.",
      messages: [
        {
          role: "user" as const,
          content: `Extract the investment thesis from this input and return a JSON object with exactly these fields:
{
  ticker: string (uppercase stock ticker, e.g. AAPL, infer if not explicit),
  companyName: string (full company name),
  thesisStatement: string (1-3 sentence summary of why they own this stock),
  investingStyle: string (one of: value, growth, income, turnaround, macro),
  assumptions: array of up to 4 objects, each with:
    category: one of: growth, economics, moat, management,
    statement: string (what must be true, one sentence),
    breakCondition: string (what would break this assumption, one sentence)
  bullCase: string (brief best case scenario, or empty string if not mentioned),
  bearCase: string (brief worst case scenario, or empty string if not mentioned),
  exitCriteria: string (when they would sell, or empty string if not mentioned),
  confidenceLevel: one of: high, medium, low (infer from tone and language)
}

User input: ${rawInput}${researchBlock}`,
        },
      ],
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

    const parsed = JSON.parse(raw) as ExtractedThesis

    return NextResponse.json({ data: parsed })
  } catch (error) {
    console.error("Analysis failed:", error)
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
  }
}
