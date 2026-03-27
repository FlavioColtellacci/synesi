import { NextResponse } from "next/server"
import { enforceResponseGuardrails } from "@/lib/chat/guard"
import { buildChatSystemPrompt } from "@/lib/chat/policy"
import { normalizeHistory, parseAssistantResponse } from "@/lib/chat/parse"
import type { ChatRequestMessage } from "@/lib/chat/types"
import { createLlm, getTextModel } from "@/lib/llm"
import { createClient } from "@/lib/supabase/server"

type ChatRequestBody = {
  message?: string
  messages?: ChatRequestMessage[]
  context?: {
    currentPath?: string
  }
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
            .select("ticker")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(8),
        ])
      thesisCount = freshThesisCount ?? 0
      openAlertsCount = freshOpenAlertsCount ?? 0
      tickers = (latestTheses ?? []).map((thesis) => thesis.ticker)
      userContextCache.set(user.id, {
        expiresAt: now + USER_CONTEXT_CACHE_TTL_MS,
        thesisCount,
        openAlertsCount,
        tickers,
      })
    }

    const model = getTextModel()
    const llm = createLlm()
    const systemPrompt = buildChatSystemPrompt({
      email: user.email ?? null,
      thesisCount: thesisCount ?? 0,
      openAlertsCount: openAlertsCount ?? 0,
      tickers: tickers ?? [],
      currentPath: body.context?.currentPath ?? "unknown",
    })

    const completion = await llm.messages.create({
      model,
      max_tokens: 900,
      system: systemPrompt,
      messages: toModelMessages(history, latestMessage),
    })

    const rawText = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim()

    const parsed = parseAssistantResponse(rawText)
    const fallback = {
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
    } as const

    const responsePayload = enforceResponseGuardrails(parsed ?? fallback)

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
      }),
    )

    return NextResponse.json(responsePayload)
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
