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
import type { Firestore } from "firebase-admin/firestore"
import { createRepositories } from "@/lib/data/repositories"
import { newDocumentId, toFirestorePayload } from "@/lib/data/firestore-utils"

type MonitorBackend = SupabaseClient | Firestore

const MAX_EVIDENCE_ITEMS = 4

function isFirestoreBackend(backend: MonitorBackend): backend is Firestore {
  return "collection" in backend
}

function nowIso() {
  return new Date().toISOString()
}

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

function parseFirestoreRunRow(
  userId: string,
  fallbackRunKey: string,
  id: string,
  data: Record<string, unknown>,
): SigmaMonitorRunRow {
  return {
    id,
    user_id: typeof data.user_id === "string" ? data.user_id : userId,
    run_key: typeof data.run_key === "string" ? data.run_key : fallbackRunKey,
    trigger_source: data.trigger_source === "cron" ? "cron" : "manual",
    status:
      data.status === "running" || data.status === "failed" || data.status === "success"
        ? data.status
        : "running",
    summary: (data.summary as SigmaMonitorRunRow["summary"]) ?? null,
    error_message: typeof data.error_message === "string" ? data.error_message : null,
    started_at: typeof data.started_at === "string" ? data.started_at : nowIso(),
    completed_at: typeof data.completed_at === "string" ? data.completed_at : null,
    created_at: typeof data.created_at === "string" ? data.created_at : nowIso(),
    updated_at: typeof data.updated_at === "string" ? data.updated_at : nowIso(),
  }
}

async function loadMonitorData(backend: MonitorBackend, userId: string) {
  if (isFirestoreBackend(backend)) {
    const repositories = createRepositories({})
    const [thesesRows, eventsRows, sourceMatchesSnapshot, uploadsSnapshot] = await Promise.all([
      repositories.theses.listDashboardByUserId(userId),
      repositories.events.listMonitorEventsByUserId(userId, 40),
      backend
        .collection("thesis_source_matches")
        .where("user_id", "==", userId)
        .orderBy("created_at", "desc")
        .limit(30)
        .get(),
      backend
        .collection("chat_uploaded_documents")
        .where("user_id", "==", userId)
        .where("status", "==", "ready")
        .orderBy("created_at", "desc")
        .limit(8)
        .get(),
    ])

    const theses = thesesRows.map((row) => ({
      id: row.id,
      ticker: row.ticker,
      company_name: row.company_name,
      status: row.status,
      updated_at: row.updated_at,
      thesis_statement: row.thesis_statement,
    })) as MonitorThesisRow[]
    const events = eventsRows as MonitorEventRow[]

    const sourceMatches = sourceMatchesSnapshot.docs.map((doc) => {
      const row = (doc.data() ?? {}) as Record<string, unknown>
      return {
        match_reason: typeof row.match_reason === "string" ? row.match_reason : null,
        confidence: typeof row.confidence === "string" ? row.confidence : null,
        relevance_score: typeof row.relevance_score === "number" ? row.relevance_score : null,
        source_document_id: typeof row.source_document_id === "string" ? row.source_document_id : "",
      }
    })
    const sourceDocumentIds = sourceMatches
      .map((row) => row.source_document_id)
      .filter((value) => value.length > 0)
    const sourceDocumentsById = new Map<string, Record<string, unknown>>()
    if (sourceDocumentIds.length > 0) {
      const snapshots = await Promise.all(
        sourceDocumentIds.map((sourceDocumentId) =>
          backend.collection("source_documents").doc(sourceDocumentId).get(),
        ),
      )
      for (const snapshot of snapshots) {
        if (!snapshot.exists) continue
        sourceDocumentsById.set(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>)
      }
    }

    const sourceEvidence = sourceMatches
      .map((row) => {
        const sourceDoc = sourceDocumentsById.get(row.source_document_id) ?? null
        const reason = typeof row.match_reason === "string" ? row.match_reason.trim() : ""
        const title = typeof sourceDoc?.title === "string" ? sourceDoc.title.trim() : "Untitled source"
        const sourceName = typeof sourceDoc?.source_name === "string" ? sourceDoc.source_name.trim() : "Source"
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

    const uploadEvidence = uploadsSnapshot.docs
      .map((doc) => {
        const row = (doc.data() ?? {}) as Record<string, unknown>
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

  const [thesesResult, eventsResult, sourceMatchesResult, uploadsResult] = await Promise.all([
    backend
      .from("theses")
      .select("id,ticker,company_name,status,updated_at,thesis_statement")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(40),
    backend
      .from("events")
      .select("thesis_id,event_type,event_detail,created_at")
      .eq("user_id", userId)
      .eq("is_reviewed", false)
      .order("created_at", { ascending: false })
      .limit(40),
    backend
      .from("thesis_source_matches")
      .select(
        "match_reason,confidence,relevance_score,source_documents(title,source_name,content_excerpt),thesis_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    backend
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
  backend: MonitorBackend,
  userId: string,
  runKey: string,
): Promise<SigmaMonitorRunRow | null> {
  if (isFirestoreBackend(backend)) {
    const snapshot = await backend
      .collection("sigma_monitor_runs")
      .where("user_id", "==", userId)
      .where("run_key", "==", runKey)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return parseFirestoreRunRow(userId, runKey, doc.id, (doc.data() ?? {}) as Record<string, unknown>)
  }

  const { data, error } = await backend
    .from("sigma_monitor_runs")
    .select("*")
    .eq("user_id", userId)
    .eq("run_key", runKey)
    .maybeSingle()
  if (error) throw error
  return (data as SigmaMonitorRunRow | null) ?? null
}

async function findPreviousMonitorRun(
  backend: MonitorBackend,
  userId: string,
  currentRunKey: string,
): Promise<SigmaMonitorRunRow | null> {
  if (isFirestoreBackend(backend)) {
    const snapshot = await backend
      .collection("sigma_monitor_runs")
      .where("user_id", "==", userId)
      .orderBy("created_at", "desc")
      .limit(20)
      .get()
    for (const doc of snapshot.docs) {
      const row = parseFirestoreRunRow(
        userId,
        "",
        doc.id,
        (doc.data() ?? {}) as Record<string, unknown>,
      )
      if (row.run_key !== currentRunKey && row.summary) return row
    }
    return null
  }

  const { data, error } = await backend
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
  backend: MonitorBackend,
  userId: string,
): Promise<SigmaMonitorSnapshot | null> {
  if (isFirestoreBackend(backend)) {
    const snapshot = await backend
      .collection("sigma_monitor_runs")
      .where("user_id", "==", userId)
      .orderBy("created_at", "desc")
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    const row = parseFirestoreRunRow(
      userId,
      "",
      doc.id,
      (doc.data() ?? {}) as Record<string, unknown>,
    )
    return mapRunRowToSnapshot(row)
  }

  const { data, error } = await backend
    .from("sigma_monitor_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
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
  backend: MonitorBackend,
  options: RunSigmaMonitorOptions,
): Promise<{ snapshot: SigmaMonitorSnapshot; createdNewRun: boolean }> {
  const { userId, runKey, triggerSource, force = false } = options
  const existing = await findRunByKey(backend, userId, runKey)

  if (reuseExistingMonitorRun(existing, force)) {
    return {
      snapshot: mapRunRowToSnapshot(existing as SigmaMonitorRunRow),
      createdNewRun: false,
    }
  }

  if (existing) {
    const payload = {
      status: "running",
      summary: null,
      error_message: null,
      trigger_source: triggerSource,
      started_at: nowIso(),
      completed_at: null,
      updated_at: nowIso(),
    }
    if (isFirestoreBackend(backend)) {
      await backend.collection("sigma_monitor_runs").doc(existing.id).set(payload, { merge: true })
    } else {
      const { error: resetError } = await backend.from("sigma_monitor_runs").update(payload).eq("id", existing.id)
      if (resetError) throw resetError
    }
  } else {
    const now = nowIso()
    const payload = {
      id: newDocumentId(),
      user_id: userId,
      run_key: runKey,
      trigger_source: triggerSource,
      status: "running",
      summary: null,
      error_message: null,
      started_at: now,
      completed_at: null,
      created_at: now,
      updated_at: now,
    }
    if (isFirestoreBackend(backend)) {
      await backend.collection("sigma_monitor_runs").doc(payload.id).set(payload)
    } else {
      const { error: insertError } = await backend.from("sigma_monitor_runs").insert(payload)
      if (insertError) throw insertError
    }
  }

  const previousRun = await findPreviousMonitorRun(backend, userId, runKey)
  const previousSummary = previousRun?.summary ?? null
  const { theses, events, evidenceSnippets } = await loadMonitorData(backend, userId)
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
  const completedAt = nowIso()
  if (isFirestoreBackend(backend)) {
    const latestRun = await findRunByKey(backend, userId, runKey)
    if (!latestRun) {
      throw new Error("Monitor run completed but could not be loaded")
    }
    await backend.collection("sigma_monitor_runs").doc(latestRun.id).set(
      toFirestorePayload({
        status: nextStatus,
        summary: finalSummary,
        error_message: failedMessage,
        completed_at: completedAt,
        updated_at: completedAt,
      }),
      { merge: true },
    )
  } else {
    const { error: finalizeError } = await backend
      .from("sigma_monitor_runs")
      .update({
        status: nextStatus,
        summary: finalSummary,
        error_message: failedMessage,
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq("user_id", userId)
      .eq("run_key", runKey)

    if (finalizeError) throw finalizeError
  }

  const latest = await findRunByKey(backend, userId, runKey)
  if (!latest) {
    throw new Error("Monitor run completed but could not be loaded")
  }

  return {
    snapshot: mapRunRowToSnapshot(latest),
    createdNewRun: !existing,
  }
}
