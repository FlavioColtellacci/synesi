import type {
  SigmaMonitorRunRow,
  SigmaMonitorSnapshot,
  SigmaMonitorSummary,
  SigmaMonitorTriggerSource,
} from "@/lib/chat/monitor-types"
import {
  applyMonitorSummaryNoiseRules,
  buildSigmaMonitorDelta,
  buildSigmaMonitorSnapshotMeta,
  buildDeterministicMonitorSummary,
  buildMonitorPrompt,
  dedupeStringLinesPreserveOrder,
  parseMonitorSummaryFromModel,
  reuseExistingMonitorRun,
  type MonitorEventRow,
  type MonitorThesisRow,
} from "@/lib/chat/monitor-logic"
import { createLlm, getTextModel } from "@/lib/llm"
import type { SupabaseClient } from "@supabase/supabase-js"

const MAX_EVIDENCE_ITEMS = 4

function mapRunRowToSnapshot(row: SigmaMonitorRunRow): SigmaMonitorSnapshot {
  return {
    id: row.id,
    runKey: row.run_key,
    triggerSource: row.trigger_source,
    status: row.status,
    summary: row.summary,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}

async function loadMonitorData(supabase: SupabaseClient, userId: string) {
  const [thesesResult, eventsResult, sourceMatchesResult, uploadsResult] = await Promise.all([
    supabase
      .from("theses")
      .select("id,ticker,company_name,status,updated_at,thesis_statement")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("events")
      .select("thesis_id,event_type,event_detail,created_at")
      .eq("user_id", userId)
      .eq("is_reviewed", false)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("thesis_source_matches")
      .select(
        "match_reason,confidence,relevance_score,source_documents(title,source_name,content_excerpt),thesis_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("chat_uploaded_documents")
      .select("file_name,extracted_text")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  const theses = (thesesResult.data ?? []) as MonitorThesisRow[]
  const events = (eventsResult.data ?? []) as MonitorEventRow[]
  const sourceEvidence = (sourceMatchesResult.data ?? [])
    .map((row) => {
      const sourceDoc = row.source_documents as
        | { title?: string | null; source_name?: string | null; content_excerpt?: string | null }
        | null
      const reason = typeof row.match_reason === "string" ? row.match_reason.trim() : ""
      const title = sourceDoc?.title?.trim() || "Untitled source"
      const sourceName = sourceDoc?.source_name?.trim() || "Source"
      const excerpt =
        typeof sourceDoc?.content_excerpt === "string"
          ? sourceDoc.content_excerpt.replace(/\s+/g, " ").trim().slice(0, 120)
          : ""
      const confidence = typeof row.confidence === "string" ? row.confidence : "unknown"
      const relevance = typeof row.relevance_score === "number" ? row.relevance_score.toFixed(2) : "n/a"
      const reasonPart = reason ? `reason=${reason}` : "reason=not captured"
      const excerptPart = excerpt ? ` | excerpt=${excerpt}` : ""
      return `[Doc] ${sourceName} - ${title} | ${reasonPart} | confidence=${confidence}, relevance=${relevance}${excerptPart}`
    })
    .filter((item) => item.length > 0)

  const uploadEvidence = (uploadsResult.data ?? [])
    .map((row) => {
      const fileName = typeof row.file_name === "string" ? row.file_name.trim() : "uploaded-document"
      const excerpt =
        typeof row.extracted_text === "string"
          ? row.extracted_text.replace(/\s+/g, " ").trim().slice(0, 140)
          : ""
      if (!excerpt) return ""
      return `[Upload] ${fileName} | excerpt=${excerpt}`
    })
    .filter((item) => item.length > 0)

  const evidenceSnippets = dedupeStringLinesPreserveOrder(
    [...sourceEvidence, ...uploadEvidence],
    MAX_EVIDENCE_ITEMS,
  )

  return { theses, events, evidenceSnippets }
}

async function findRunByKey(
  supabase: SupabaseClient,
  userId: string,
  runKey: string,
): Promise<SigmaMonitorRunRow | null> {
  const { data, error } = await supabase
    .from("sigma_monitor_runs")
    .select("*")
    .eq("user_id", userId)
    .eq("run_key", runKey)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as SigmaMonitorRunRow | null) ?? null
}

async function findPreviousMonitorRun(
  supabase: SupabaseClient,
  userId: string,
  currentRunKey: string,
): Promise<SigmaMonitorRunRow | null> {
  const { data, error } = await supabase
    .from("sigma_monitor_runs")
    .select("*")
    .eq("user_id", userId)
    .neq("run_key", currentRunKey)
    .not("summary", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as SigmaMonitorRunRow | null) ?? null
}

export async function getLatestSigmaMonitorRun(
  supabase: SupabaseClient,
  userId: string,
): Promise<SigmaMonitorSnapshot | null> {
  const { data, error } = await supabase
    .from("sigma_monitor_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) return null
  return mapRunRowToSnapshot(data as SigmaMonitorRunRow)
}

export type RunSigmaMonitorOptions = {
  userId: string
  runKey: string
  triggerSource: SigmaMonitorTriggerSource
  force?: boolean
}

function monitorNoiseContext(theses: MonitorThesisRow[], events: MonitorEventRow[]): {
  openAlertCount: number
  needsReviewCount: number
} {
  const needsReviewCount = theses.filter((t) => t.status === "at_risk" || t.status === "broken").length
  return { openAlertCount: events.length, needsReviewCount }
}

export async function runSigmaMonitorForUser(
  supabase: SupabaseClient,
  options: RunSigmaMonitorOptions,
): Promise<{ snapshot: SigmaMonitorSnapshot; createdNewRun: boolean }> {
  const { userId, runKey, triggerSource, force = false } = options
  const existing = await findRunByKey(supabase, userId, runKey)

  if (reuseExistingMonitorRun(existing, force)) {
    return {
      snapshot: mapRunRowToSnapshot(existing as SigmaMonitorRunRow),
      createdNewRun: false,
    }
  }

  if (existing) {
    const { error: resetError } = await supabase
      .from("sigma_monitor_runs")
      .update({
        status: "running",
        summary: null,
        error_message: null,
        trigger_source: triggerSource,
        started_at: new Date().toISOString(),
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)

    if (resetError) throw resetError
  } else {
    const { error: insertError } = await supabase.from("sigma_monitor_runs").insert({
      user_id: userId,
      run_key: runKey,
      trigger_source: triggerSource,
      status: "running",
    })
    if (insertError) throw insertError
  }

  const previousRun = await findPreviousMonitorRun(supabase, userId, runKey)
  const previousSummary = previousRun?.summary ?? null
  const { theses, events, evidenceSnippets } = await loadMonitorData(supabase, userId)
  const snapshotMeta = buildSigmaMonitorSnapshotMeta(theses, events)
  const delta = buildSigmaMonitorDelta(previousSummary, snapshotMeta, previousRun?.run_key ?? null)
  const noiseCtx = monitorNoiseContext(theses, events)
  const fallbackSummary = buildDeterministicMonitorSummary(
    theses,
    events,
    evidenceSnippets,
    delta,
    snapshotMeta,
    previousSummary,
  )

  let finalSummary: SigmaMonitorSummary = fallbackSummary
  let failedMessage: string | null = null

  try {
    const llm = createLlm()
    const model = getTextModel()
    const completion = await llm.messages.create({
      model,
      max_tokens: 650,
      system: buildMonitorPrompt(theses, events, fallbackSummary, delta, previousSummary),
      messages: [{ role: "user", content: "Generate the monitor digest now." }],
    })

    const rawText = completion.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim()

    const parsed = parseMonitorSummaryFromModel(rawText, fallbackSummary)
    finalSummary = applyMonitorSummaryNoiseRules(parsed, noiseCtx)
  } catch (error) {
    failedMessage = error instanceof Error ? error.message : "Unknown monitor generation error"
    finalSummary = fallbackSummary
  }

  const nextStatus = failedMessage ? "failed" : "success"
  const nowIso = new Date().toISOString()
  const { error: finalizeError } = await supabase
    .from("sigma_monitor_runs")
    .update({
      status: nextStatus,
      summary: finalSummary,
      error_message: failedMessage,
      completed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .eq("run_key", runKey)

  if (finalizeError) throw finalizeError

  const latest = await findRunByKey(supabase, userId, runKey)
  if (!latest) {
    throw new Error("Monitor run completed but could not be loaded")
  }

  return {
    snapshot: mapRunRowToSnapshot(latest),
    createdNewRun: !existing,
  }
}
