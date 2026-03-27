import { NextResponse } from "next/server"
import { enforceResponseGuardrails } from "@/lib/chat/guard"
import { extractFirstUrl, fetchSafeWebContext } from "@/lib/chat/web-context"
import { buildChatSystemPrompt } from "@/lib/chat/policy"
import { normalizeHistory, parseAssistantResponse, parseAssistantTextFallback } from "@/lib/chat/parse"
import type { ChatAssistantResponse, ChatRequestMessage } from "@/lib/chat/types"
import { createLlm, getTextModel } from "@/lib/llm"
import { createClient } from "@/lib/supabase/server"

type ChatRequestBody = {
  message?: string
  messages?: ChatRequestMessage[]
  context?: {
    currentPath?: string
  }
}

type PositionSnapshot = {
  ticker: string
  status: string
}

const MAX_MESSAGE_CHARS = 900
const MAX_HISTORY_MESSAGES = 8
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 18
const USER_CONTEXT_CACHE_TTL_MS = 60 * 1000

const userRateLimit = new Map<string, number[]>()
const userContextCache = new Map<
  string,
  {
    expiresAt: number
    thesisCount: number
    openAlertsCount: number
    tickers: string[]
    positions: PositionSnapshot[]
  }
>()

function isRateLimited(userId: string, now: number) {
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const currentHits = (userRateLimit.get(userId) ?? []).filter((timestamp) => timestamp >= windowStart)
  currentHits.push(now)
  userRateLimit.set(userId, currentHits)
  return currentHits.length > RATE_LIMIT_MAX_REQUESTS
}

function toModelMessages(history: ChatRequestMessage[], latestMessage: string) {
  return [
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user" as const, content: latestMessage },
  ]
}

function buildPositionSummary(positions: PositionSnapshot[]) {
  if (positions.length === 0) {
    return "No saved convictions."
  }

  const intact = positions.filter((position) => position.status === "intact").length
  const atRisk = positions.filter((position) => position.status === "at_risk").length
  const broken = positions.filter((position) => position.status === "broken").length
  const top = positions.slice(0, 5).map((position) => `${position.ticker}:${position.status}`).join(", ")

  return `Intact ${intact}, At risk ${atRisk}, Broken ${broken}. Recent: ${top}.`
}

function isPositionsQuestion(message: string) {
  return /(position|positions|conviction|convictions|portfolio|how are my|how's my)/i.test(message)
}

function buildLinkSafetyResponse(reason: string): ChatAssistantResponse {
  return {
    answer: `${reason} Share a public HTTPS article link and I will summarize it for you.`,
    sourceTags: ["PolicyGuide"],
    confidence: "high",
    escalation: "none",
    followUpActions: ["Share a different HTTPS link", "Paste the article text directly", "Ask a Synesi workflow question"],
  }
}

function buildPositionsFallback(message: string, positions: PositionSnapshot[]): ChatAssistantResponse {
  if (isPositionsQuestion(message)) {
    if (positions.length === 0) {
      return {
        answer:
          "You do not have saved convictions yet. Create your first thesis in New Thesis, and I can help you monitor position health from there.",
        sourceTags: ["WorkflowGuide", "ProductGuide"],
        confidence: "high",
        escalation: "none",
        followUpActions: ["Create your first thesis", "Ask how status tracking works", "Set up trusted sources"],
      }
    }

    const intact = positions.filter((position) => position.status === "intact").length
    const atRisk = positions.filter((position) => position.status === "at_risk").length
    const broken = positions.filter((position) => position.status === "broken").length
    const top = positions.slice(0, 5).map((position) => `${position.ticker} (${position.status})`).join(", ")

    return {
      answer: `Current snapshot: ${positions.length} convictions total — ${intact} intact, ${atRisk} at risk, ${broken} broken. Recent convictions: ${top}.`,
      sourceTags: ["ProductGuide"],
      confidence: "high",
      escalation: "none",
      followUpActions: ["Open NEEDS REVIEW filter", "Inspect at-risk convictions", "Ask me for next actions"],
    }
  }

  return {
    answer:
      "I could not reliably parse that response. Please ask again, or try a more specific Synesi question like 'how do I set trusted sources?'",
    sourceTags: ["PolicyGuide"],
    confidence: "low",
    escalation: "support",
    followUpActions: [
      "Ask a specific Synesi workflow question",
      "Try again in a moment",
      "Contact support if this repeats",
    ],
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()

  try {
    const body = (await request.json()) as ChatRequestBody
    const latestMessage = body.message?.trim()
    const history = normalizeHistory(body.messages ?? []).slice(-MAX_HISTORY_MESSAGES)

    if (!latestMessage) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 })
    }
    if (latestMessage.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Message too long. Maximum ${MAX_MESSAGE_CHARS} characters.` },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = Date.now()
    if (isRateLimited(user.id, now)) {
      return NextResponse.json(
        {
          answer:
            "You are sending messages quickly. Please wait a moment, then try again so I can respond carefully.",
          sourceTags: ["PolicyGuide"],
          confidence: "high",
          escalation: "none",
          followUpActions: ["Wait a short moment", "Send one focused question", "Try again"],
        },
        { status: 429 },
      )
    }

    const cachedContext = userContextCache.get(user.id)
    let thesisCount = cachedContext?.thesisCount
    let openAlertsCount = cachedContext?.openAlertsCount
    let tickers = cachedContext?.tickers
    let positions = cachedContext?.positions

    if (!cachedContext || cachedContext.expiresAt <= now) {
      const [{ count: freshThesisCount }, { count: freshOpenAlertsCount }, { data: latestTheses }] =
        await Promise.all([
          supabase.from("theses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase
            .from("events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_reviewed", false),
          supabase
            .from("theses")
            .select("ticker,status")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(8),
        ])
      thesisCount = freshThesisCount ?? 0
      openAlertsCount = freshOpenAlertsCount ?? 0
      positions = (latestTheses ?? []).map((thesis) => ({
        ticker: thesis.ticker,
        status: thesis.status,
      }))
      tickers = (positions ?? []).map((thesis) => thesis.ticker)
      userContextCache.set(user.id, {
        expiresAt: now + USER_CONTEXT_CACHE_TTL_MS,
        thesisCount,
        openAlertsCount,
        tickers,
        positions,
      })
    }

    const sharedUrl = extractFirstUrl(latestMessage)
    let latestMessageForModel = latestMessage
    let webContextPromptSection = ""
    let usedSafeWebContext = false

    if (sharedUrl) {
      const webContext = await fetchSafeWebContext(sharedUrl)
      if (!webContext.ok) {
        return NextResponse.json(buildLinkSafetyResponse(webContext.reason), { status: 200 })
      }

      webContextPromptSection = `LIVE WEB CONTEXT (safe-fetched by backend)\n- URL: ${webContext.sourceUrl}\n- Title: ${webContext.title}\n- Excerpt:\n${webContext.excerpt}`

      latestMessageForModel = `${latestMessage}\n\nThe user included a URL that has already been safely fetched. Use the provided live web context in your answer when relevant.`
      usedSafeWebContext = true
    }

    const model = getTextModel()
    const llm = createLlm()
    const systemPrompt = buildChatSystemPrompt({
      email: user.email ?? null,
      thesisCount: thesisCount ?? 0,
      openAlertsCount: openAlertsCount ?? 0,
      tickers: tickers ?? [],
      positionSummary: buildPositionSummary(positions ?? []),
      currentPath: body.context?.currentPath ?? "unknown",
    })

    const completion = await llm.messages.create({
      model,
      max_tokens: 900,
      system: webContextPromptSection ? `${systemPrompt}\n\n${webContextPromptSection}` : systemPrompt,
      messages: toModelMessages(history, latestMessageForModel),
    })

    const rawText = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim()

    const parsed = parseAssistantResponse(rawText)
    const textFallback = parseAssistantTextFallback(rawText)
    const fallback: ChatAssistantResponse = buildPositionsFallback(latestMessageForModel, positions ?? [])

    const responsePayload = enforceResponseGuardrails(parsed ?? textFallback ?? fallback)

    console.info(
      JSON.stringify({
        event: "chat_request",
        requestId,
        userId: user.id,
        model,
        latencyMs: Date.now() - startedAt,
        sourceTags: responsePayload.sourceTags,
        confidence: responsePayload.confidence,
        escalation: responsePayload.escalation,
        usedSafeWebContext,
      }),
    )

    return NextResponse.json({
      ...responsePayload,
      webContextVerified: usedSafeWebContext,
    })
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "chat_error",
        requestId,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    )
    return NextResponse.json(
      {
        answer:
          "I hit a temporary issue. Please try again in a moment. If this keeps happening, contact support.",
        sourceTags: ["PolicyGuide"],
        confidence: "low",
        escalation: "support",
        followUpActions: ["Retry your question", "Ask a narrower Synesi question", "Contact support"],
      },
      { status: 500 },
    )
  }
}
