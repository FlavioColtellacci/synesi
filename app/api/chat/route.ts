import { NextResponse } from "next/server"
import { enforceResponseGuardrails } from "@/lib/chat/guard"
import { getLatestSigmaMonitorRun } from "@/lib/chat/monitor"
import { persistChatExchange } from "@/lib/chat/store"
import { extractFirstUrl, fetchSafeWebContext } from "@/lib/chat/web-context"
import { buildChatSystemPrompt } from "@/lib/chat/policy"
import { normalizeHistory, parseAssistantResponse, parseAssistantTextFallback } from "@/lib/chat/parse"
import { buildRagContextBlock } from "@/lib/chat/rag"
import type { ChatAssistantResponse, ChatRequestMessage } from "@/lib/chat/types"
import { createLlm, getTextModel } from "@/lib/llm"
import { getWebResearchContext } from "@/lib/web-research"
import { createClient } from "@/lib/supabase/server"

type ChatRequestBody = {
  message?: string
  messages?: ChatRequestMessage[]
  context?: {
    currentPath?: string
  }
}

type PositionSnapshot = {
  id: string
  ticker: string
  companyName: string
  status: string
  updatedAt: string
}

type AlertSnapshot = {
  thesisId: string
  ticker: string
  companyName: string
  eventType: string
  eventDetail: string
  createdAt: string
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
    alerts: AlertSnapshot[]
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

function isInternetLookupQuestion(message: string) {
  return /((look(\s+those)?\s+(up|online))|lookup|search (the )?(web|internet|online)|web search|internet|online|latest news|recent news|headlines?|news (on|about)|read (the )?articles?|fetch (the )?(news|headlines|articles?)|what happened (today|this week|this month))/i.test(
    message,
  )
}

function isMonitorSummaryQuestion(message: string) {
  return /(sigma monitor|monitor summary|what changed since last run|latest monitor)/i.test(message)
}

function hasWebCapabilityDenial(answer: string) {
  const normalized = answer.toLowerCase()
  return (
    /(i\s+(do not|don't|cannot|can't)\s+.*(browse|fetch|access|open)).*(web|internet|url|urls|online|external)/i.test(
      normalized,
    ) ||
    /without (real[- ]?time|internet) access/i.test(normalized)
  )
}

function buildWebLookupUnavailableNowResponse(): ChatAssistantResponse {
  return {
    answer:
      "I can help with web lookups, but live retrieval is temporarily unavailable in this session. Share one or more public HTTPS article links and I will summarize them precisely.",
    sourceTags: ["PolicyGuide", "WorkflowGuide"],
    confidence: "medium",
    escalation: "none",
    followUpActions: ["Share the article URLs", "Paste key excerpts here", "Ask me to compare sources once shared"],
  }
}

function buildRecentConvictionsLine(positions: PositionSnapshot[]) {
  if (positions.length === 0) return "none"
  return positions
    .slice(0, 8)
    .map((position) => `${position.ticker} (${position.status}, updated ${new Date(position.updatedAt).toISOString().slice(0, 10)})`)
    .join(" | ")
}

function buildRecentAlertsLine(alerts: AlertSnapshot[]) {
  if (alerts.length === 0) return "none"
  return alerts
    .slice(0, 8)
    .map((alert) => `${alert.ticker} [${alert.eventType}] ${alert.eventDetail}`)
    .join(" | ")
}

function truncateEventDetail(input: string | null, maxChars = 140) {
  const normalized = (input ?? "").replace(/\s+/g, " ").trim()
  if (!normalized) return "No detail provided"
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars - 1)}…`
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

function mapMonitorSnapshotToChatResponse(snapshot: NonNullable<Awaited<ReturnType<typeof getLatestSigmaMonitorRun>>>): ChatAssistantResponse {
  if (!snapshot.summary) {
    return {
      answer:
        "A monitor run exists, but the summary is not available yet. You can trigger a fresh monitor run from the dashboard monitor card.",
      sourceTags: ["WorkflowGuide", "ProductGuide"],
      confidence: "medium",
      escalation: "none",
      followUpActions: ["Open dashboard", "Refresh Sigma Monitor", "Ask for a convictions snapshot"],
    }
  }

  const summary = snapshot.summary
  const highSignals =
    summary.highSignalChanges.length > 0
      ? summary.highSignalChanges.map((line) => `- ${line}`).join("\n")
      : "- No high-signal changes detected in this run."
  const nextActions = summary.recommendedActions.map((action) => action.label).slice(0, 3)

  return {
    answer: `${summary.headline}\n\n${summary.summary}\n\nWhat changed:\n${highSignals}`,
    sourceTags: ["ProductGuide", "WorkflowGuide"],
    confidence: summary.riskLevel === "critical" ? "high" : "medium",
    escalation: summary.recommendedActions.length > 0 ? "action_confirmation" : "none",
    followUpActions:
      nextActions.length > 0
        ? nextActions
        : ["Open dashboard", "Review open alerts", "Ask for thesis-specific guidance"],
    actionDrafts: summary.recommendedActions,
    retrievalEvidence: summary.evidenceSnippets.map((snippet) => ({ source: "source_match", snippet })),
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

    if (isMonitorSummaryQuestion(latestMessage)) {
      const monitor = await getLatestSigmaMonitorRun(supabase, user.id)
      if (monitor) {
        const monitorResponse = mapMonitorSnapshotToChatResponse(monitor)
        try {
          await persistChatExchange(supabase, user.id, latestMessage, monitorResponse)
        } catch (persistError) {
          console.warn(
            JSON.stringify({
              event: "chat_persist_warning",
              requestId,
              userId: user.id,
              error: persistError instanceof Error ? persistError.message : "Unknown persist error",
            }),
          )
        }
        return NextResponse.json(monitorResponse)
      }
    }

    const cachedContext = userContextCache.get(user.id)
    let thesisCount = cachedContext?.thesisCount
    let openAlertsCount = cachedContext?.openAlertsCount
    let tickers = cachedContext?.tickers
    let positions = cachedContext?.positions
    let alerts = cachedContext?.alerts

    if (!cachedContext || cachedContext.expiresAt <= now) {
      const [{ count: freshThesisCount }, { count: freshOpenAlertsCount }, { data: latestTheses }, { data: latestAlerts }] =
        await Promise.all([
          supabase.from("theses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase
            .from("events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_reviewed", false),
          supabase
            .from("theses")
            .select("id,ticker,company_name,status,updated_at")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(12),
          supabase
            .from("events")
            .select("thesis_id,event_type,event_detail,created_at")
            .eq("user_id", user.id)
            .eq("is_reviewed", false)
            .order("created_at", { ascending: false })
            .limit(12),
        ])
      thesisCount = freshThesisCount ?? 0
      openAlertsCount = freshOpenAlertsCount ?? 0
      positions = (latestTheses ?? []).map((thesis) => ({
        id: thesis.id,
        ticker: thesis.ticker,
        companyName: thesis.company_name,
        status: thesis.status,
        updatedAt: thesis.updated_at,
      }))
      tickers = (positions ?? []).map((thesis) => thesis.ticker)
      const thesisById = new Map(positions.map((thesis) => [thesis.id, thesis]))
      const missingThesisIds = Array.from(
        new Set(
          (latestAlerts ?? [])
            .map((event) => event.thesis_id)
            .filter((thesisId) => thesisId && !thesisById.has(thesisId)),
        ),
      )

      if (missingThesisIds.length > 0) {
        const { data: missingTheses } = await supabase
          .from("theses")
          .select("id,ticker,company_name,status,updated_at")
          .eq("user_id", user.id)
          .in("id", missingThesisIds)

        for (const thesis of missingTheses ?? []) {
          thesisById.set(thesis.id, {
            id: thesis.id,
            ticker: thesis.ticker,
            companyName: thesis.company_name,
            status: thesis.status,
            updatedAt: thesis.updated_at,
          })
        }
      }

      alerts = (latestAlerts ?? [])
        .map((event) => {
          const thesis = thesisById.get(event.thesis_id)
          if (!thesis) return null
          return {
            thesisId: event.thesis_id,
            ticker: thesis.ticker,
            companyName: thesis.companyName,
            eventType: event.event_type,
            eventDetail: truncateEventDetail(event.event_detail),
            createdAt: event.created_at,
          }
        })
        .filter((event): event is AlertSnapshot => event !== null)

      userContextCache.set(user.id, {
        expiresAt: now + USER_CONTEXT_CACHE_TTL_MS,
        thesisCount,
        openAlertsCount,
        tickers,
        positions,
        alerts,
      })
    }

    const sharedUrl = extractFirstUrl(latestMessage)
    let latestMessageForModel = latestMessage
    const liveContextSections: string[] = []
    let usedSafeWebContext = false
    let webContextSource: ChatAssistantResponse["webContextSource"] | undefined
    const shouldUseModelWebLookup = !sharedUrl && isInternetLookupQuestion(latestMessage)

    const ragContext = await buildRagContextBlock(supabase, user.id, latestMessage)
    if (ragContext.block) {
      liveContextSections.push(ragContext.block)
    }

    if (sharedUrl) {
      const webContext = await fetchSafeWebContext(sharedUrl)
      if (!webContext.ok) {
        return NextResponse.json(buildLinkSafetyResponse(webContext.reason), { status: 200 })
      }

      liveContextSections.push(
        `LIVE WEB CONTEXT (safe-fetched by backend)\n- URL: ${webContext.sourceUrl}\n- Title: ${webContext.title}\n- Excerpt:\n${webContext.excerpt}`,
      )

      latestMessageForModel = `${latestMessage}\n\nThe user included a URL that has already been safely fetched. Use the provided live web context in your answer when relevant.`
      usedSafeWebContext = true
      webContextSource = "safe_link"
    }

    const model = getTextModel()
    const llm = createLlm()
    const systemPrompt = buildChatSystemPrompt({
      email: user.email ?? null,
      thesisCount: thesisCount ?? 0,
      openAlertsCount: openAlertsCount ?? 0,
      tickers: tickers ?? [],
      positionSummary: buildPositionSummary(positions ?? []),
      recentConvictions: buildRecentConvictionsLine(positions ?? []),
      recentAlerts: buildRecentAlertsLine(alerts ?? []),
      currentPath: body.context?.currentPath ?? "unknown",
    })

    const resolvedSystemPrompt = (
      liveContextSections.length > 0
        ? `${systemPrompt}\n\n${liveContextSections.join("\n\n")}`
        : systemPrompt
    ).toString()

    const completionBaseRequest = {
      model,
      max_tokens: 900,
      system: resolvedSystemPrompt,
      messages: toModelMessages(history, latestMessageForModel),
    }

    function buildBraveContextBlock(research: { content: string; citations: string[] }) {
      return [
        "LIVE WEB CONTEXT (Brave Search)",
        research.content,
        research.citations.length
          ? `Sources:\n${research.citations.map((url) => `- ${url}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    }

    async function completeWithBraveInSystem(research: { content: string; citations: string[] }) {
      const braveContext = buildBraveContextBlock(research)
      webContextSource = "brave_search"
      return llm.messages.create({
        ...completionBaseRequest,
        system: `${completionBaseRequest.system}\n\n${braveContext}`,
        messages: toModelMessages(
          history,
          `${latestMessageForModel}\n\nThe system prompt includes fresh web search snippets and source URLs. Use them to answer; cite uncertainty where snippets are incomplete.`,
        ),
      })
    }

    let completion
    // Prefer Brave for explicit web-intent messages when the key works. MiniMax may return HTTP 200
    // without actually running Anthropic-style web_search tools, which produced empty "lookups".
    if (shouldUseModelWebLookup) {
      const braveFirst = await getWebResearchContext({
        focus: "company",
        query: latestMessage,
      })

      if (braveFirst.ok) {
        completion = await completeWithBraveInSystem(braveFirst)
      } else {
        try {
          completion = await llm.messages.create(
            {
              ...completionBaseRequest,
              system: `${completionBaseRequest.system}\n\nWhen the user asks for internet lookup, use built-in model web search capability if available, then cite uncertainty clearly.`,
              tools: [
                {
                  type: "web_search_20250305",
                  name: "web_search",
                  max_uses: 3,
                },
              ],
            } as never,
          )
        } catch {
          const braveResearch = await getWebResearchContext({
            focus: "company",
            query: latestMessage,
          })

          if (braveResearch.ok) {
            completion = await completeWithBraveInSystem(braveResearch)

            const rawTextWithBrave = completion.content
              .filter((block) => block.type === "text")
              .map((block) => block.text)
              .join("")
              .trim()

            const parsedWithBrave = parseAssistantResponse(rawTextWithBrave)
            const textFallbackWithBrave = parseAssistantTextFallback(rawTextWithBrave)
            const fallbackWithBrave: ChatAssistantResponse = buildPositionsFallback(latestMessageForModel, positions ?? [])

            const responsePayloadWithBrave = enforceResponseGuardrails(
              parsedWithBrave ?? textFallbackWithBrave ?? fallbackWithBrave,
            )
            const webLookupTemporarilyUnavailableWithBrave = hasWebCapabilityDenial(responsePayloadWithBrave.answer)
            const normalizedResponsePayloadWithBrave = webLookupTemporarilyUnavailableWithBrave
              ? buildWebLookupUnavailableNowResponse()
              : responsePayloadWithBrave
            const responsePayloadWithWebContext: ChatAssistantResponse = {
              ...normalizedResponsePayloadWithBrave,
              retrievalEvidence:
                ragContext.snippets.length > 0
                  ? ragContext.snippets.map((snippet) => ({ source: "source_match" as const, snippet }))
                  : normalizedResponsePayloadWithBrave.retrievalEvidence,
              webContextVerified: usedSafeWebContext,
              webContextSource,
              webLookupTemporarilyUnavailable: webLookupTemporarilyUnavailableWithBrave,
            }

            try {
              await persistChatExchange(supabase, user.id, latestMessage, responsePayloadWithWebContext)
            } catch (persistError) {
              console.warn(
                JSON.stringify({
                  event: "chat_persist_warning",
                  requestId,
                  userId: user.id,
                  error: persistError instanceof Error ? persistError.message : "Unknown persist error",
                }),
              )
            }

            console.info(
              JSON.stringify({
                event: "chat_request",
                requestId,
                userId: user.id,
                model,
                latencyMs: Date.now() - startedAt,
                sourceTags: normalizedResponsePayloadWithBrave.sourceTags,
                confidence: normalizedResponsePayloadWithBrave.confidence,
                escalation: normalizedResponsePayloadWithBrave.escalation,
                usedSafeWebContext,
                webContextSource,
                webLookupTemporarilyUnavailable: webLookupTemporarilyUnavailableWithBrave,
              }),
            )

            return NextResponse.json(responsePayloadWithWebContext)
          }

          completion = await llm.messages.create({
            ...completionBaseRequest,
            messages: toModelMessages(
              history,
              `${latestMessageForModel}\n\nIf live web lookup is unavailable right now, do not claim a permanent inability to browse. Say it is temporarily unavailable in this session, then ask for public HTTPS URLs for precise summarization.`,
            ),
          })
        }
      }
    } else {
      completion = await llm.messages.create(completionBaseRequest)
    }

    const rawText = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim()

    const parsed = parseAssistantResponse(rawText)
    const textFallback = parseAssistantTextFallback(rawText)
    const fallback: ChatAssistantResponse = buildPositionsFallback(latestMessageForModel, positions ?? [])

    const responsePayload = enforceResponseGuardrails(parsed ?? textFallback ?? fallback)
    const webLookupTemporarilyUnavailable =
      shouldUseModelWebLookup && hasWebCapabilityDenial(responsePayload.answer)
    const normalizedResponsePayload = webLookupTemporarilyUnavailable
      ? buildWebLookupUnavailableNowResponse()
      : responsePayload
    const responsePayloadWithWebContext: ChatAssistantResponse = {
      ...normalizedResponsePayload,
      retrievalEvidence:
        ragContext.snippets.length > 0
          ? ragContext.snippets.map((snippet) => ({ source: "source_match" as const, snippet }))
          : normalizedResponsePayload.retrievalEvidence,
      webContextVerified: usedSafeWebContext,
      webContextSource,
      webLookupTemporarilyUnavailable,
    }

    try {
      await persistChatExchange(supabase, user.id, latestMessage, responsePayloadWithWebContext)
    } catch (persistError) {
      console.warn(
        JSON.stringify({
          event: "chat_persist_warning",
          requestId,
          userId: user.id,
          error: persistError instanceof Error ? persistError.message : "Unknown persist error",
        }),
      )
    }

    console.info(
      JSON.stringify({
        event: "chat_request",
        requestId,
        userId: user.id,
        model,
        latencyMs: Date.now() - startedAt,
        sourceTags: normalizedResponsePayload.sourceTags,
        confidence: normalizedResponsePayload.confidence,
        escalation: normalizedResponsePayload.escalation,
        usedSafeWebContext,
        webContextSource,
        webLookupTemporarilyUnavailable,
      }),
    )

    return NextResponse.json(responsePayloadWithWebContext)
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
