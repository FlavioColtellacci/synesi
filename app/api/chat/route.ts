import { NextResponse } from "next/server"
import { enforceResponseGuardrails } from "@/lib/chat/guard"
import { getLatestSigmaMonitorRun } from "@/lib/chat/monitor"
import { getUserSigmaMemoryProfile, persistChatExchange, syncUserReleaseRing } from "@/lib/chat/store"
import { extractFirstUrl, fetchSafeWebContext } from "@/lib/chat/web-context"
import { buildChatSystemPrompt, type ChatSkillRoute } from "@/lib/chat/policy"
import { normalizeHistory, parseAssistantResponse, parseAssistantTextFallback, parseStructuredPayload } from "@/lib/chat/parse"
import { buildRagContextBlock } from "@/lib/chat/rag"
import { buildUploadedDocumentContextBlock } from "@/lib/chat/uploads"
import { createSigmaExportsForResponse } from "@/lib/chat/exports"
import { resolveEvalGateDecision, runChatEvalHarness } from "@/lib/chat/evals"
import { isRingIncludedInRollout, readRolloutTargetRing, resolveReleaseRing } from "@/lib/chat/release-rings"
import type { ChatAssistantResponse, ChatRequestMessage } from "@/lib/chat/types"
import { createLlm, getTextModel } from "@/lib/llm"
import { getWebResearchContext } from "@/lib/web-research"
import { createClient } from "@/lib/supabase/server"

type ChatRequestBody = {
  message?: string
  messages?: ChatRequestMessage[]
  attachmentIds?: string[]
  context?: {
    currentPath?: string
    webSearchEnabled?: boolean
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
const PLAN_MAX_STEPS = 5
const MAX_ATTACHMENT_IDS = 4
const TOOL_LOOP_MAX_STEPS = 4
const TOOL_LOOP_MAX_CALLS = 8
const TOOL_LOOP_MAX_FAILURES = 3
const TOOL_LOOP_TIMEOUT_MS = 9_000

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

function readBooleanFlag(value: string | undefined, defaultValue: boolean) {
  if (!value) return defaultValue
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "on", "yes"].includes(normalized)) return true
  if (["0", "false", "off", "no"].includes(normalized)) return false
  return defaultValue
}

function isSkillRoutingEnabled() {
  return readBooleanFlag(process.env.SIGMA_PHASE1_SKILLS_ROUTER_ENABLED, true)
}

function isPlanThenAnswerEnabled() {
  return readBooleanFlag(process.env.SIGMA_PHASE1_PLAN_THEN_ANSWER_ENABLED, false)
}

function isStrictJsonModeEnabled() {
  return readBooleanFlag(process.env.SIGMA_PHASE1_STRICT_JSON_ENABLED, true)
}

function isPhase4AgentToolsEnabled() {
  return readBooleanFlag(process.env.SIGMA_PHASE4_AGENT_TOOLS_ENABLED, false)
}

function isPhase6MemoryEnabled() {
  return readBooleanFlag(process.env.SIGMA_PHASE6_MEMORY_ENABLED, true)
}

function isPhase6EvalHarnessEnabled() {
  return readBooleanFlag(process.env.SIGMA_PHASE6_EVAL_HARNESS_ENABLED, true)
}

function isPhase6EvalGateEnforced() {
  return readBooleanFlag(process.env.SIGMA_PHASE6_EVAL_GATE_ENFORCED, false)
}

function resolveSkillRoute(message: string): ChatSkillRoute {
  if (
    /(review (my )?thesis|thesis review|stress test|challenge (my )?thesis|bull case|bear case|variant perception|assumption)/i.test(
      message,
    )
  ) {
    return "thesis_review"
  }
  if (/(triage|prioriti[sz]e|which|what).*(alert|needs review)|open alerts|alert queue|alert backlog/i.test(message)) {
    return "alert_triage"
  }
  if (/(sigma monitor|monitor summary|what changed since last run|latest monitor|explain monitor)/i.test(message)) {
    return "monitor_explain"
  }
  return "general"
}

function shouldUsePlanThenAnswer(message: string) {
  const trimmed = message.trim()
  if (trimmed.length >= 260) return true
  if (trimmed.split("\n").length >= 4) return true
  const questionMarks = (trimmed.match(/\?/g) ?? []).length
  if (questionMarks >= 2) return true
  return /(compare|versus|vs\.|trade[- ]?off|step[- ]?by[- ]?step|plan|strategy|analyze|analysis|synthesize|prioritize)/i.test(
    trimmed,
  )
}

type ChatPlan = {
  steps: string[]
  cautions: string[]
}

function parsePlanPayload(rawText: string): ChatPlan | null {
  const payload = parseStructuredPayload(rawText)
  if (!payload) return null

  const steps = Array.isArray(payload.steps)
    ? payload.steps.filter((step): step is string => typeof step === "string").map((step) => step.trim()).filter(Boolean)
    : []
  const cautions = Array.isArray(payload.cautions)
    ? payload.cautions
        .filter((caution): caution is string => typeof caution === "string")
        .map((caution) => caution.trim())
        .filter(Boolean)
    : []

  if (steps.length === 0) return null
  return {
    steps: steps.slice(0, PLAN_MAX_STEPS),
    cautions: cautions.slice(0, 3),
  }
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

function buildEvalGateFallbackResponse(): ChatAssistantResponse {
  return {
    answer:
      "I could not safely finalize that answer under current quality gates. Please retry with a narrower prompt, and I will provide a fully grounded response.",
    sourceTags: ["PolicyGuide"],
    confidence: "low",
    escalation: "support",
    followUpActions: ["Retry with a focused question", "Ask for a step-by-step workflow", "Contact support if this repeats"],
    artifacts: [],
    requestedExports: [],
  }
}

function buildResponseFromRawText(args: {
  rawText: string
  messageForFallback: string
  positions: PositionSnapshot[]
  strictJsonMode: boolean
}): ChatAssistantResponse {
  const parsed = parseAssistantResponse(args.rawText)
  const textFallback = args.strictJsonMode ? null : parseAssistantTextFallback(args.rawText)
  const fallback = buildPositionsFallback(args.messageForFallback, args.positions)
  return enforceResponseGuardrails(parsed ?? textFallback ?? fallback)
}

function mergeRetrievalEvidence(args: {
  ragSnippets: string[]
  uploadedDocSnippets: string[]
  existing?: ChatAssistantResponse["retrievalEvidence"]
}): ChatAssistantResponse["retrievalEvidence"] {
  const fromRag = args.ragSnippets.map((snippet) => ({ source: "source_match" as const, snippet }))
  const fromUploads = args.uploadedDocSnippets.map((snippet) => ({ source: "uploaded_document" as const, snippet }))
  return [...fromRag, ...fromUploads, ...(args.existing ?? [])].slice(0, 5)
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
      answer: `Current snapshot: ${positions.length} convictions total; ${intact} intact, ${atRisk} at risk, ${broken} broken. Recent convictions: ${top}.`,
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

type ToolUseBlock = {
  id: string
  name: string
  input: Record<string, unknown>
}

type AgentToolLoopStats = {
  used: boolean
  steps: number
  toolCalls: number
  failures: number
  breakerTripped: boolean
}

const READ_ONLY_AGENT_TOOLS = [
  {
    name: "list_open_alerts",
    description: "List the user's recent unresolved alerts.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_thesis_snapshot",
    description: "Get thesis snapshot by thesisId or ticker.",
    input_schema: {
      type: "object",
      properties: {
        thesisId: { type: "string" },
        ticker: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_latest_monitor_snapshot",
    description: "Get the latest Sigma Monitor snapshot summary.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_uploaded_document_excerpts",
    description: "Get excerpts from user uploaded documents.",
    input_schema: {
      type: "object",
      properties: {
        documentIds: {
          type: "array",
          items: { type: "string" },
          maxItems: 4,
        },
        limit: { type: "number", minimum: 1, maximum: 4 },
      },
      additionalProperties: false,
    },
  },
] as const

function asObject(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function readNumber(input: unknown, fallback: number, min: number, max: number) {
  if (typeof input !== "number" || !Number.isFinite(input)) return fallback
  return Math.max(min, Math.min(max, Math.floor(input)))
}

function readString(input: unknown, maxLength: number) {
  if (typeof input !== "string") return ""
  return input.trim().slice(0, maxLength)
}

function parseToolUseBlocks(content: unknown): ToolUseBlock[] {
  if (!Array.isArray(content)) return []
  const blocks: ToolUseBlock[] = []
  for (const item of content) {
    const record = asObject(item)
    const type = readString(record.type, 40)
    if (type !== "tool_use") continue
    const id = readString(record.id, 120)
    const name = readString(record.name, 80)
    if (!id || !name) continue
    blocks.push({
      id,
      name,
      input: asObject(record.input),
    })
  }
  return blocks
}

export async function invokeReadOnlyTool(args: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  attachmentIds: string[]
  tool: ToolUseBlock
}) {
  const { supabase, userId, attachmentIds, tool } = args
  const startedAt = Date.now()

  try {
    if (tool.name === "list_open_alerts") {
      const limit = readNumber(tool.input.limit, 6, 1, 20)
      const { data: latestAlerts } = await supabase
        .from("events")
        .select("thesis_id,event_type,event_detail,created_at")
        .eq("user_id", userId)
        .eq("is_reviewed", false)
        .order("created_at", { ascending: false })
        .limit(limit)

      const thesisIds = Array.from(new Set((latestAlerts ?? []).map((event) => event.thesis_id).filter(Boolean)))
      let thesisById = new Map<string, string>()
      if (thesisIds.length > 0) {
        const { data: theses } = await supabase
          .from("theses")
          .select("id,ticker")
          .eq("user_id", userId)
          .in("id", thesisIds)
        thesisById = new Map((theses ?? []).map((thesis) => [thesis.id, thesis.ticker]))
      }

      const alerts = (latestAlerts ?? []).map((event) => ({
        thesisId: event.thesis_id,
        ticker: thesisById.get(event.thesis_id) ?? "unknown",
        eventType: event.event_type,
        eventDetail: truncateEventDetail(event.event_detail),
        createdAt: event.created_at,
      }))

      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
        result: { count: alerts.length, alerts },
      }
    }

    if (tool.name === "get_thesis_snapshot") {
      const thesisId = readString(tool.input.thesisId, 120)
      const ticker = readString(tool.input.ticker, 24).toUpperCase()

      let query = supabase
        .from("theses")
        .select("id,ticker,company_name,status,thesis_statement,updated_at")
        .eq("user_id", userId)
      if (thesisId) {
        query = query.eq("id", thesisId)
      } else if (ticker) {
        query = query.ilike("ticker", ticker)
      } else {
        return {
          ok: false,
          latencyMs: Date.now() - startedAt,
          result: { error: "Provide thesisId or ticker." },
        }
      }

      const { data: thesis } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle()
      if (!thesis) {
        return {
          ok: false,
          latencyMs: Date.now() - startedAt,
          result: { error: "No thesis found." },
        }
      }

      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
        result: {
          thesis: {
            id: thesis.id,
            ticker: thesis.ticker,
            companyName: thesis.company_name,
            status: thesis.status,
            thesisStatement: (thesis.thesis_statement ?? "").slice(0, 700),
            updatedAt: thesis.updated_at,
          },
        },
      }
    }

    if (tool.name === "get_latest_monitor_snapshot") {
      const snapshot = await getLatestSigmaMonitorRun(supabase, userId)
      if (!snapshot) {
        return {
          ok: true,
          latencyMs: Date.now() - startedAt,
          result: { available: false },
        }
      }
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
        result: {
          available: true,
          snapshot: {
            id: snapshot.id,
            status: snapshot.status,
            createdAt: snapshot.createdAt,
            completedAt: snapshot.completedAt,
            summary: snapshot.summary,
          },
        },
      }
    }

    if (tool.name === "get_uploaded_document_excerpts") {
      const requestedIds = Array.isArray(tool.input.documentIds)
        ? tool.input.documentIds
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean)
        : []
      const limit = readNumber(tool.input.limit, 3, 1, 4)
      const ids = (requestedIds.length > 0 ? requestedIds : attachmentIds).slice(0, 4)
      const query = supabase
        .from("chat_uploaded_documents")
        .select("id,file_name,extracted_text,status,created_at")
        .eq("user_id", userId)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(limit)
      const { data } = ids.length > 0 ? await query.in("id", ids) : await query

      const documents = (data ?? []).map((doc) => ({
        id: doc.id,
        fileName: doc.file_name,
        excerpt: (doc.extracted_text ?? "").slice(0, 700),
        createdAt: doc.created_at,
      }))
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
        result: { count: documents.length, documents },
      }
    }

    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      result: { error: `Unknown tool '${tool.name}'.` },
    }
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      result: { error: error instanceof Error ? error.message : "Tool execution failed." },
    }
  }
}

export async function runBoundedReadOnlyToolLoop(args: {
  llm: ReturnType<typeof createLlm>
  baseRequest: {
    model: string
    max_tokens: number
    system: string
    messages: { role: "user" | "assistant"; content: string }[]
  }
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  requestId: string
  attachmentIds: string[]
}) {
  const startedAt = Date.now()
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [...args.baseRequest.messages]
  let failures = 0
  let toolCalls = 0
  let steps = 0
  let breakerTripped = false

  while (steps < TOOL_LOOP_MAX_STEPS && toolCalls < TOOL_LOOP_MAX_CALLS && Date.now() - startedAt < TOOL_LOOP_TIMEOUT_MS) {
    const completion = await args.llm.messages.create(
      {
        model: args.baseRequest.model,
        max_tokens: args.baseRequest.max_tokens,
        system: args.baseRequest.system,
        tools: READ_ONLY_AGENT_TOOLS,
        messages: messages as never,
      } as never,
    )
    steps += 1

    const toolUses = parseToolUseBlocks(completion.content)
    if (toolUses.length === 0) {
      return {
        completion,
        stats: {
          used: toolCalls > 0,
          steps,
          toolCalls,
          failures,
          breakerTripped,
        } satisfies AgentToolLoopStats,
      }
    }

    const toolResultBlocks: Array<Record<string, unknown>> = []
    for (const toolUse of toolUses) {
      if (toolCalls >= TOOL_LOOP_MAX_CALLS) {
        breakerTripped = true
        break
      }

      const result = await invokeReadOnlyTool({
        supabase: args.supabase,
        userId: args.userId,
        attachmentIds: args.attachmentIds,
        tool: toolUse,
      })
      toolCalls += 1
      if (!result.ok) failures += 1

      console.info(
        JSON.stringify({
          event: "chat_tool_audit",
          requestId: args.requestId,
          userId: args.userId,
          step: steps,
          toolName: toolUse.name,
          success: result.ok,
          latencyMs: result.latencyMs,
          failures,
        }),
      )

      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        is_error: !result.ok,
        content: JSON.stringify(result.result),
      })

      if (failures >= TOOL_LOOP_MAX_FAILURES) {
        breakerTripped = true
        break
      }
    }

    messages.push({ role: "assistant", content: completion.content })
    messages.push({ role: "user", content: toolResultBlocks })

    if (breakerTripped) break
  }

  const fallbackCompletion = await args.llm.messages.create(
    {
      model: args.baseRequest.model,
      max_tokens: args.baseRequest.max_tokens,
      system: args.baseRequest.system,
      messages: [
        ...messages,
        {
          role: "user",
          content:
            "Tool execution reached a safety limit for this request. Continue without further tools and provide the best answer from available context.",
        },
      ] as never,
    } as never,
  )

  return {
    completion: fallbackCompletion,
    stats: {
      used: toolCalls > 0,
      steps,
      toolCalls,
      failures,
      breakerTripped,
    } satisfies AgentToolLoopStats,
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()

  try {
    const body = (await request.json()) as ChatRequestBody
    const latestMessage = body.message?.trim()
    const history = normalizeHistory(body.messages ?? []).slice(-MAX_HISTORY_MESSAGES)
    const attachmentIds = Array.isArray(body.attachmentIds)
      ? [...new Set(body.attachmentIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))]
          .slice(0, MAX_ATTACHMENT_IDS)
      : []

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

    const userReleaseRing = resolveReleaseRing({ userId: user.id, email: user.email })
    const memoryTargetRing = readRolloutTargetRing(process.env.SIGMA_PHASE6_MEMORY_TARGET_RING, "internal")
    const evalTargetRing = readRolloutTargetRing(process.env.SIGMA_PHASE6_EVAL_TARGET_RING, "internal")
    const phase6MemoryEnabled =
      isPhase6MemoryEnabled() && isRingIncludedInRollout({ userRing: userReleaseRing, targetRing: memoryTargetRing })
    const phase6EvalHarnessEnabled =
      isPhase6EvalHarnessEnabled() &&
      isRingIncludedInRollout({ userRing: userReleaseRing, targetRing: evalTargetRing })
    const phase6EvalGateEnforced =
      isPhase6EvalGateEnforced() &&
      isRingIncludedInRollout({ userRing: userReleaseRing, targetRing: evalTargetRing })

    try {
      await syncUserReleaseRing(supabase, user.id, userReleaseRing)
    } catch {
      // Ring sync should not block chat responses.
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
    const webSearchEnabled = body.context?.webSearchEnabled === true
    const shouldUseModelWebLookup = webSearchEnabled && !sharedUrl && isInternetLookupQuestion(latestMessage)
    const skillRoutingEnabled = isSkillRoutingEnabled()
    const planThenAnswerEnabled = isPlanThenAnswerEnabled()
    const strictJsonMode = isStrictJsonModeEnabled()
    const phase4AgentToolsEnabled = isPhase4AgentToolsEnabled()
    const skillRoute = skillRoutingEnabled ? resolveSkillRoute(latestMessage) : "general"
    const shouldPlanFirst = planThenAnswerEnabled && shouldUsePlanThenAnswer(latestMessage)

    const ragContext = await buildRagContextBlock(supabase, user.id, latestMessage)
    if (ragContext.block) {
      liveContextSections.push(ragContext.block)
    }
    const uploadedDocumentContext = await buildUploadedDocumentContextBlock(supabase, user.id, attachmentIds)
    if (uploadedDocumentContext.block) {
      liveContextSections.push(uploadedDocumentContext.block)
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
    let sigmaMemoryProfile: Awaited<ReturnType<typeof getUserSigmaMemoryProfile>> | null = null
    if (phase6MemoryEnabled) {
      try {
        sigmaMemoryProfile = await getUserSigmaMemoryProfile(supabase, user.id)
      } catch {
        sigmaMemoryProfile = null
      }
    }
    const systemPrompt = buildChatSystemPrompt({
      email: user.email ?? null,
      thesisCount: thesisCount ?? 0,
      openAlertsCount: openAlertsCount ?? 0,
      tickers: tickers ?? [],
      positionSummary: buildPositionSummary(positions ?? []),
      recentConvictions: buildRecentConvictionsLine(positions ?? []),
      recentAlerts: buildRecentAlertsLine(alerts ?? []),
      currentPath: body.context?.currentPath ?? "unknown",
      memoryProfile: sigmaMemoryProfile
        ? {
            enabled: sigmaMemoryProfile.enabled,
            investmentFocus: sigmaMemoryProfile.profile.investmentFocus,
            monitoringPreferences: sigmaMemoryProfile.profile.monitoringPreferences,
            communicationStyle: sigmaMemoryProfile.profile.communicationStyle,
            notes: sigmaMemoryProfile.profile.notes,
          }
        : undefined,
    }, { skillRoute, planThenAnswerEnabled })

    const resolvedSystemPrompt = (
      liveContextSections.length > 0
        ? `${systemPrompt}\n\n${liveContextSections.join("\n\n")}`
        : systemPrompt
    ).toString()

    let completionBaseRequest = {
      model,
      max_tokens: 4096,
      system: resolvedSystemPrompt,
      messages: toModelMessages(history, latestMessageForModel),
    }
    let toolLoopStats: AgentToolLoopStats = {
      used: false,
      steps: 0,
      toolCalls: 0,
      failures: 0,
      breakerTripped: false,
    }

    if (shouldPlanFirst) {
      try {
        const planCompletion = await llm.messages.create({
          ...completionBaseRequest,
          max_tokens: 600,
          system: `${completionBaseRequest.system}\n\nINTERNAL PLANNING INSTRUCTION\nReturn JSON only with keys: steps (array of short strings) and cautions (array of short strings). Do not include answer text.`,
          messages: toModelMessages(
            history,
            `${latestMessageForModel}\n\nCreate a concise internal plan that will help produce a better final answer. Keep steps practical and grounded in available Synesi context.`,
          ),
        })
        const planRawText = planCompletion.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim()
        const parsedPlan = parsePlanPayload(planRawText)

        if (parsedPlan) {
          const cautionBlock =
            parsedPlan.cautions.length > 0 ? `Cautions:\n${parsedPlan.cautions.map((item) => `- ${item}`).join("\n")}` : ""
          latestMessageForModel = [
            latestMessageForModel,
            "INTERNAL PLAN CONTEXT (already prepared by backend):",
            parsedPlan.steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
            cautionBlock,
            "Use this plan to improve reasoning quality, but do not expose this planning artifact in the final answer.",
          ]
            .filter(Boolean)
            .join("\n\n")
          completionBaseRequest = {
            ...completionBaseRequest,
            messages: toModelMessages(history, latestMessageForModel),
          }
        }
      } catch {
        // Planning is best-effort and must never block baseline answering.
      }
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

            const responsePayloadWithBrave = buildResponseFromRawText({
              rawText: rawTextWithBrave,
              messageForFallback: latestMessageForModel,
              positions: positions ?? [],
              strictJsonMode,
            })
            const webLookupTemporarilyUnavailableWithBrave = hasWebCapabilityDenial(responsePayloadWithBrave.answer)
            const normalizedResponsePayloadWithBrave = webLookupTemporarilyUnavailableWithBrave
              ? buildWebLookupUnavailableNowResponse()
              : responsePayloadWithBrave
            const responsePayloadWithWebContext: ChatAssistantResponse = {
              ...normalizedResponsePayloadWithBrave,
              retrievalEvidence: mergeRetrievalEvidence({
                ragSnippets: ragContext.clientEvidenceSnippets,
                uploadedDocSnippets: uploadedDocumentContext.evidenceSnippets,
                existing: normalizedResponsePayloadWithBrave.retrievalEvidence,
              }),
              webContextVerified: usedSafeWebContext,
              webContextSource,
              webLookupTemporarilyUnavailable: webLookupTemporarilyUnavailableWithBrave,
            }
            let exportArtifacts: ChatAssistantResponse["artifacts"] = []
            try {
              exportArtifacts = await createSigmaExportsForResponse({
                supabase,
                userId: user.id,
                requestId,
                response: responsePayloadWithWebContext,
                positions: positions ?? [],
                alerts: alerts ?? [],
              })
            } catch {
              exportArtifacts = []
            }
            const finalResponsePayloadWithWebContext: ChatAssistantResponse = {
              ...responsePayloadWithWebContext,
              requestedExports: [],
              artifacts: exportArtifacts,
            }
            const evalResult = phase6EvalHarnessEnabled
              ? runChatEvalHarness({
                  response: finalResponsePayloadWithWebContext,
                  strictJsonMode,
                  hadAttachments: attachmentIds.length > 0,
                })
              : null
            const evalGateDecision = resolveEvalGateDecision({
              gateEnforced: phase6EvalGateEnforced,
              evalResult,
            })
            const gatedFinalResponsePayload: ChatAssistantResponse = evalGateDecision.gated
              ? buildEvalGateFallbackResponse()
              : finalResponsePayloadWithWebContext

            try {
              await persistChatExchange(supabase, user.id, latestMessage, gatedFinalResponsePayload)
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
                artifactsCount: exportArtifacts.length,
                skillRoute,
                planThenAnswerEnabled,
                strictJsonMode,
                plannedFirst: shouldPlanFirst,
                usedSafeWebContext,
                webContextSource,
                webLookupTemporarilyUnavailable: webLookupTemporarilyUnavailableWithBrave,
                phase4AgentToolsEnabled,
                phase6MemoryEnabled,
                phase6EvalHarnessEnabled,
                phase6EvalGateEnforced,
                userReleaseRing,
                memoryOptIn: sigmaMemoryProfile?.enabled === true,
                evalPass: evalResult?.pass ?? null,
                evalGateDecision: evalGateDecision.reason,
                evalFailures: evalResult?.failures ?? [],
                toolLoopUsed: false,
                toolLoopSteps: 0,
                toolLoopCalls: 0,
                toolLoopFailures: 0,
                toolLoopBreakerTripped: false,
              }),
            )

            return NextResponse.json(gatedFinalResponsePayload)
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
    } else if (phase4AgentToolsEnabled) {
      const loopResult = await runBoundedReadOnlyToolLoop({
        llm,
        baseRequest: completionBaseRequest,
        supabase,
        userId: user.id,
        requestId,
        attachmentIds,
      })
      completion = loopResult.completion
      toolLoopStats = loopResult.stats
    } else {
      completion = await llm.messages.create(completionBaseRequest)
    }

    const rawText = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim()

    const responsePayload = buildResponseFromRawText({
      rawText,
      messageForFallback: latestMessageForModel,
      positions: positions ?? [],
      strictJsonMode,
    })
    const webLookupTemporarilyUnavailable =
      shouldUseModelWebLookup && hasWebCapabilityDenial(responsePayload.answer)
    const normalizedResponsePayload = webLookupTemporarilyUnavailable
      ? buildWebLookupUnavailableNowResponse()
      : responsePayload
    const responsePayloadWithWebContext: ChatAssistantResponse = {
      ...normalizedResponsePayload,
      retrievalEvidence: mergeRetrievalEvidence({
        ragSnippets: ragContext.clientEvidenceSnippets,
        uploadedDocSnippets: uploadedDocumentContext.evidenceSnippets,
        existing: normalizedResponsePayload.retrievalEvidence,
      }),
      webContextVerified: usedSafeWebContext,
      webContextSource,
      webLookupTemporarilyUnavailable,
    }
    let exportArtifacts: ChatAssistantResponse["artifacts"] = []
    try {
      exportArtifacts = await createSigmaExportsForResponse({
        supabase,
        userId: user.id,
        requestId,
        response: responsePayloadWithWebContext,
        positions: positions ?? [],
        alerts: alerts ?? [],
      })
    } catch {
      exportArtifacts = []
    }
    const finalResponsePayloadWithWebContext: ChatAssistantResponse = {
      ...responsePayloadWithWebContext,
      requestedExports: [],
      artifacts: exportArtifacts,
    }
    const evalResult = phase6EvalHarnessEnabled
      ? runChatEvalHarness({
          response: finalResponsePayloadWithWebContext,
          strictJsonMode,
          hadAttachments: attachmentIds.length > 0,
        })
      : null
    const evalGateDecision = resolveEvalGateDecision({
      gateEnforced: phase6EvalGateEnforced,
      evalResult,
    })
    const gatedFinalResponsePayload: ChatAssistantResponse = evalGateDecision.gated
      ? buildEvalGateFallbackResponse()
      : finalResponsePayloadWithWebContext

    try {
      await persistChatExchange(supabase, user.id, latestMessage, gatedFinalResponsePayload)
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
        artifactsCount: exportArtifacts.length,
        skillRoute,
        planThenAnswerEnabled,
        strictJsonMode,
        plannedFirst: shouldPlanFirst,
        usedSafeWebContext,
        webContextSource,
        webLookupTemporarilyUnavailable,
        phase4AgentToolsEnabled,
        phase6MemoryEnabled,
        phase6EvalHarnessEnabled,
        phase6EvalGateEnforced,
        userReleaseRing,
        memoryOptIn: sigmaMemoryProfile?.enabled === true,
        evalPass: evalResult?.pass ?? null,
        evalGateDecision: evalGateDecision.reason,
        evalFailures: evalResult?.failures ?? [],
        toolLoopUsed: toolLoopStats.used,
        toolLoopSteps: toolLoopStats.steps,
        toolLoopCalls: toolLoopStats.toolCalls,
        toolLoopFailures: toolLoopStats.failures,
        toolLoopBreakerTripped: toolLoopStats.breakerTripped,
      }),
    )

    return NextResponse.json(gatedFinalResponsePayload)
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
