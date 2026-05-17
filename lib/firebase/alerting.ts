import { createHash } from "node:crypto"
import type { Firestore } from "firebase-admin/firestore"
import type { Database } from "@/types/database"
import { newDocumentId, toFirestorePayload } from "@/lib/data/firestore-utils"

type ThesisRow = Database["public"]["Tables"]["theses"]["Row"]
type TrustedSourceRow = Database["public"]["Tables"]["trusted_sources"]["Row"]
type TrustedSourceInsert = Database["public"]["Tables"]["trusted_sources"]["Insert"]
type AlertRuleRow = Database["public"]["Tables"]["alert_rules"]["Row"]
type AlertRuleInsert = Database["public"]["Tables"]["alert_rules"]["Insert"]
type AlertRuleUpdate = Database["public"]["Tables"]["alert_rules"]["Update"]
type SourceDocumentInsert = Database["public"]["Tables"]["source_documents"]["Insert"]
type ThesisSourceMatchInsert = Database["public"]["Tables"]["thesis_source_matches"]["Insert"]
type EventInsert = Database["public"]["Tables"]["events"]["Insert"]
type PushSubscriptionRow = Database["public"]["Tables"]["push_subscriptions"]["Row"]

function nowIso() {
  return new Date().toISOString()
}

function stablePairId(first: string, second: string) {
  return createHash("sha256").update(`${first}::${second}`).digest("hex")
}

function stableTripleId(first: string, second: string, third: string) {
  return createHash("sha256").update(`${first}::${second}::${third}`).digest("hex")
}

function normalizeThesisRow(thesisId: string, data: Record<string, unknown>): ThesisRow {
  const now = nowIso()
  return {
    id: thesisId,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    ticker: typeof data.ticker === "string" ? data.ticker : "",
    company_name: typeof data.company_name === "string" ? data.company_name : "",
    thesis_statement: typeof data.thesis_statement === "string" ? data.thesis_statement : "",
    investing_style: typeof data.investing_style === "string" ? data.investing_style : null,
    bull_case: typeof data.bull_case === "string" ? data.bull_case : null,
    base_case: typeof data.base_case === "string" ? data.base_case : null,
    bear_case: typeof data.bear_case === "string" ? data.bear_case : null,
    exit_criteria: typeof data.exit_criteria === "string" ? data.exit_criteria : null,
    confidence_level: typeof data.confidence_level === "string" ? data.confidence_level : "medium",
    status: typeof data.status === "string" ? data.status : "intact",
    purchase_date: typeof data.purchase_date === "string" ? data.purchase_date : null,
    purchase_price: typeof data.purchase_price === "number" ? data.purchase_price : null,
    created_at: typeof data.created_at === "string" ? data.created_at : now,
    updated_at: typeof data.updated_at === "string" ? data.updated_at : now,
  }
}

function normalizeTrustedSourceRow(
  sourceId: string,
  data: Record<string, unknown>,
): TrustedSourceRow {
  return {
    id: sourceId,
    thesis_id: typeof data.thesis_id === "string" ? data.thesis_id : "",
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    name: typeof data.name === "string" ? data.name : "",
    url: typeof data.url === "string" ? data.url : null,
    source_type: typeof data.source_type === "string" ? data.source_type : "other",
    created_at: typeof data.created_at === "string" ? data.created_at : nowIso(),
  }
}

function normalizeAlertRuleRow(ruleId: string, data: Record<string, unknown>): AlertRuleRow {
  const mode = data.mode
  const minConfidence = data.min_confidence
  return {
    id: ruleId,
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    thesis_id: typeof data.thesis_id === "string" ? data.thesis_id : "",
    name: typeof data.name === "string" ? data.name : "",
    mode:
      mode === "only_sources" || mode === "include_sources" || mode === "exclude_sources"
        ? mode
        : "only_sources",
    min_confidence: minConfidence === "high" || minConfidence === "medium" ? minConfidence : "high",
    include_keywords: Array.isArray(data.include_keywords)
      ? data.include_keywords.filter((item): item is string => typeof item === "string")
      : [],
    exclude_keywords: Array.isArray(data.exclude_keywords)
      ? data.exclude_keywords.filter((item): item is string => typeof item === "string")
      : [],
    is_enabled: typeof data.is_enabled === "boolean" ? data.is_enabled : true,
    created_at: typeof data.created_at === "string" ? data.created_at : nowIso(),
    updated_at: typeof data.updated_at === "string" ? data.updated_at : nowIso(),
  }
}

export async function isOwnedThesis(
  firestore: Firestore,
  userId: string,
  thesisId: string,
): Promise<boolean> {
  const snapshot = await firestore.collection("theses").doc(thesisId).get()
  if (!snapshot.exists) return false
  const row = normalizeThesisRow(thesisId, (snapshot.data() ?? {}) as Record<string, unknown>)
  return row.user_id === userId
}

export async function getOwnedThesis(
  firestore: Firestore,
  userId: string,
  thesisId: string,
): Promise<ThesisRow | null> {
  const snapshot = await firestore.collection("theses").doc(thesisId).get()
  if (!snapshot.exists) return null
  const row = normalizeThesisRow(thesisId, (snapshot.data() ?? {}) as Record<string, unknown>)
  return row.user_id === userId ? row : null
}

export async function listTrustedSourcesByThesis(
  firestore: Firestore,
  userId: string,
  thesisId: string,
): Promise<TrustedSourceRow[]> {
  const snapshot = await firestore
    .collection("trusted_sources")
    .where("thesis_id", "==", thesisId)
    .where("user_id", "==", userId)
    .orderBy("created_at", "asc")
    .get()

  return snapshot.docs.map((doc) =>
    normalizeTrustedSourceRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>),
  )
}

export async function hasOwnedTrustedSource(
  firestore: Firestore,
  userId: string,
  thesisId: string,
  trustedSourceId: string,
): Promise<boolean> {
  const source = await firestore.collection("trusted_sources").doc(trustedSourceId).get()
  if (!source.exists) return false
  const row = normalizeTrustedSourceRow(
    trustedSourceId,
    (source.data() ?? {}) as Record<string, unknown>,
  )
  return row.user_id === userId && row.thesis_id === thesisId
}

export async function createTrustedSource(
  firestore: Firestore,
  values: TrustedSourceInsert,
): Promise<TrustedSourceRow> {
  const existing = await firestore
    .collection("trusted_sources")
    .where("user_id", "==", values.user_id)
    .where("thesis_id", "==", values.thesis_id)
    .where("name", "==", values.name)
    .limit(1)
    .get()
  if (!existing.empty) {
    throw new Error("DUPLICATE_TRUSTED_SOURCE")
  }

  const sourceId = values.id ?? newDocumentId()
  const payload = toFirestorePayload({
    ...values,
    id: sourceId,
    created_at: values.created_at ?? nowIso(),
  })
  await firestore.collection("trusted_sources").doc(sourceId).set(payload)
  return normalizeTrustedSourceRow(sourceId, payload)
}

export async function deleteOwnedTrustedSource(
  firestore: Firestore,
  userId: string,
  thesisId: string,
  sourceId: string,
): Promise<boolean> {
  if (!(await hasOwnedTrustedSource(firestore, userId, thesisId, sourceId))) {
    return false
  }
  await firestore.collection("trusted_sources").doc(sourceId).delete()
  return true
}

export async function listAlertRulesByThesis(
  firestore: Firestore,
  userId: string,
  thesisId: string,
): Promise<Array<AlertRuleRow & { sourceIds: string[] }>> {
  const snapshot = await firestore
    .collection("alert_rules")
    .where("thesis_id", "==", thesisId)
    .where("user_id", "==", userId)
    .orderBy("created_at", "asc")
    .get()

  const rows = snapshot.docs.map((doc) =>
    normalizeAlertRuleRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>),
  )
  const sourceIdsByRule = await listSourceIdsByRuleIds(
    firestore,
    rows.map((rule) => rule.id),
  )

  return rows.map((rule) => ({
    ...rule,
    sourceIds: sourceIdsByRule.get(rule.id) ?? [],
  }))
}

export async function createAlertRule(
  firestore: Firestore,
  values: AlertRuleInsert,
): Promise<AlertRuleRow> {
  const ruleId = values.id ?? newDocumentId()
  const now = nowIso()
  const payload = toFirestorePayload({
    ...values,
    id: ruleId,
    include_keywords: values.include_keywords ?? [],
    exclude_keywords: values.exclude_keywords ?? [],
    is_enabled: values.is_enabled ?? true,
    created_at: values.created_at ?? now,
    updated_at: values.updated_at ?? now,
  })
  await firestore.collection("alert_rules").doc(ruleId).set(payload)
  return normalizeAlertRuleRow(ruleId, payload)
}

export async function getOwnedAlertRule(
  firestore: Firestore,
  userId: string,
  thesisId: string,
  ruleId: string,
): Promise<AlertRuleRow | null> {
  const snapshot = await firestore.collection("alert_rules").doc(ruleId).get()
  if (!snapshot.exists) return null
  const row = normalizeAlertRuleRow(ruleId, (snapshot.data() ?? {}) as Record<string, unknown>)
  if (row.user_id !== userId || row.thesis_id !== thesisId) return null
  return row
}

export async function updateOwnedAlertRule(
  firestore: Firestore,
  userId: string,
  thesisId: string,
  ruleId: string,
  values: AlertRuleUpdate,
): Promise<AlertRuleRow | null> {
  const existing = await getOwnedAlertRule(firestore, userId, thesisId, ruleId)
  if (!existing) return null
  const payload = toFirestorePayload({
    ...values,
    updated_at: values.updated_at ?? nowIso(),
  })
  delete payload.id
  delete payload.user_id
  delete payload.thesis_id
  await firestore.collection("alert_rules").doc(ruleId).set(payload, { merge: true })
  return normalizeAlertRuleRow(ruleId, { ...existing, ...payload })
}

export async function deleteOwnedAlertRule(
  firestore: Firestore,
  userId: string,
  thesisId: string,
  ruleId: string,
): Promise<boolean> {
  const existing = await getOwnedAlertRule(firestore, userId, thesisId, ruleId)
  if (!existing) return false

  await firestore.collection("alert_rules").doc(ruleId).delete()

  const sourceMappings = await firestore
    .collection("alert_rule_sources")
    .where("alert_rule_id", "==", ruleId)
    .get()
  if (!sourceMappings.empty) {
    const batch = firestore.batch()
    for (const mapping of sourceMappings.docs) {
      batch.delete(mapping.ref)
    }
    await batch.commit()
  }
  return true
}

export async function attachAlertRuleSource(
  firestore: Firestore,
  ruleId: string,
  trustedSourceId: string,
): Promise<boolean> {
  const docId = stablePairId(ruleId, trustedSourceId)
  const ref = firestore.collection("alert_rule_sources").doc(docId)
  const snapshot = await ref.get()
  if (snapshot.exists) return false
  await ref.set({
    id: docId,
    alert_rule_id: ruleId,
    trusted_source_id: trustedSourceId,
    created_at: nowIso(),
  })
  return true
}

export async function detachAlertRuleSource(
  firestore: Firestore,
  ruleId: string,
  trustedSourceId: string,
): Promise<boolean> {
  const docId = stablePairId(ruleId, trustedSourceId)
  const ref = firestore.collection("alert_rule_sources").doc(docId)
  const snapshot = await ref.get()
  if (!snapshot.exists) return false
  await ref.delete()
  return true
}

export async function listSourceIdsByRuleIds(
  firestore: Firestore,
  ruleIds: string[],
): Promise<Map<string, string[]>> {
  const sourceIdsByRule = new Map<string, string[]>()
  if (ruleIds.length === 0) return sourceIdsByRule

  for (let index = 0; index < ruleIds.length; index += 30) {
    const chunk = ruleIds.slice(index, index + 30)
    const mappings = await firestore
      .collection("alert_rule_sources")
      .where("alert_rule_id", "in", chunk)
      .get()

    for (const mapping of mappings.docs) {
      const data = (mapping.data() ?? {}) as Record<string, unknown>
      const alertRuleId = typeof data.alert_rule_id === "string" ? data.alert_rule_id : ""
      const trustedSourceId =
        typeof data.trusted_source_id === "string" ? data.trusted_source_id : ""
      if (!alertRuleId || !trustedSourceId) continue
      const current = sourceIdsByRule.get(alertRuleId) ?? []
      current.push(trustedSourceId)
      sourceIdsByRule.set(alertRuleId, current)
    }
  }

  return sourceIdsByRule
}

export async function listIngestTrustedSources(
  firestore: Firestore,
): Promise<Pick<TrustedSourceRow, "id" | "thesis_id" | "user_id" | "name" | "url" | "source_type">[]> {
  const snapshot = await firestore.collection("trusted_sources").get()
  return snapshot.docs
    .map((doc) => normalizeTrustedSourceRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .filter((source) => Boolean(source.url))
    .map((source) => ({
      id: source.id,
      thesis_id: source.thesis_id,
      user_id: source.user_id,
      name: source.name,
      url: source.url,
      source_type: source.source_type,
    }))
}

export async function insertSourceDocumentIfNew(
  firestore: Firestore,
  row: SourceDocumentInsert,
): Promise<{ inserted: boolean; id: string }> {
  const docId = row.id ?? row.content_hash
  const ref = firestore.collection("source_documents").doc(docId)
  const snapshot = await ref.get()
  if (snapshot.exists) {
    return { inserted: false, id: docId }
  }

  const payload = toFirestorePayload({
    ...row,
    id: docId,
    created_at: row.created_at ?? nowIso(),
  })
  await ref.set(payload)
  return { inserted: true, id: docId }
}

export async function listTrustedSourcesByNames(
  firestore: Firestore,
  loweredNames: string[],
): Promise<Array<Pick<TrustedSourceRow, "id" | "thesis_id" | "user_id" | "name">>> {
  if (loweredNames.length === 0) return []
  const allSources = await firestore.collection("trusted_sources").get()
  const set = new Set(loweredNames)
  return allSources.docs
    .map((doc) => normalizeTrustedSourceRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .filter((source) => set.has(source.name.toLowerCase()))
    .map((source) => ({
      id: source.id,
      thesis_id: source.thesis_id,
      user_id: source.user_id,
      name: source.name,
    }))
}

export async function listActiveThesesByIds(
  firestore: Firestore,
  thesisIds: string[],
): Promise<Array<Pick<ThesisRow, "id" | "user_id" | "ticker" | "company_name" | "thesis_statement">>> {
  if (thesisIds.length === 0) return []

  const snapshots = await Promise.all(
    thesisIds.map((thesisId) => firestore.collection("theses").doc(thesisId).get()),
  )

  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) =>
      normalizeThesisRow(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>),
    )
    .filter((row) => row.status !== "broken")
    .map((row) => ({
      id: row.id,
      user_id: row.user_id,
      ticker: row.ticker,
      company_name: row.company_name,
      thesis_statement: row.thesis_statement,
    }))
}

export async function insertThesisSourceMatchIfNew(
  firestore: Firestore,
  row: ThesisSourceMatchInsert,
): Promise<boolean> {
  const docId =
    row.id ?? stableTripleId(row.thesis_id, row.trusted_source_id, row.source_document_id)
  const ref = firestore.collection("thesis_source_matches").doc(docId)
  const snapshot = await ref.get()
  if (snapshot.exists) return false

  const payload = toFirestorePayload({
    ...row,
    id: docId,
    created_at: row.created_at ?? nowIso(),
  })
  await ref.set(payload)
  return true
}

export async function listEnabledAlertRulesByThesisIds(
  firestore: Firestore,
  thesisIds: string[],
): Promise<AlertRuleRow[]> {
  if (thesisIds.length === 0) return []
  const rows: AlertRuleRow[] = []
  for (let index = 0; index < thesisIds.length; index += 30) {
    const chunk = thesisIds.slice(index, index + 30)
    const snapshot = await firestore
      .collection("alert_rules")
      .where("thesis_id", "in", chunk)
      .where("is_enabled", "==", true)
      .get()
    for (const doc of snapshot.docs) {
      rows.push(normalizeAlertRuleRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    }
  }
  return rows
}

export async function insertEvent(
  firestore: Firestore,
  values: EventInsert,
): Promise<void> {
  const eventId = values.id ?? newDocumentId()
  const payload = toFirestorePayload({
    ...values,
    id: eventId,
    event_detail: values.event_detail ?? null,
    is_reviewed: values.is_reviewed ?? false,
    created_at: values.created_at ?? nowIso(),
  })
  await firestore.collection("events").doc(eventId).set(payload)
}

export async function listPushSubscriptionsByUser(
  firestore: Firestore,
  userId: string,
): Promise<PushSubscriptionRow[]> {
  const snapshot = await firestore
    .collection("push_subscriptions")
    .where("user_id", "==", userId)
    .get()
  return snapshot.docs.map((doc) => {
    const data = (doc.data() ?? {}) as Record<string, unknown>
    const now = nowIso()
    return {
      id: doc.id,
      user_id: typeof data.user_id === "string" ? data.user_id : "",
      endpoint: typeof data.endpoint === "string" ? data.endpoint : "",
      p256dh: typeof data.p256dh === "string" ? data.p256dh : "",
      auth: typeof data.auth === "string" ? data.auth : "",
      created_at: typeof data.created_at === "string" ? data.created_at : now,
      updated_at: typeof data.updated_at === "string" ? data.updated_at : now,
    }
  })
}

export async function deletePushSubscriptionById(
  firestore: Firestore,
  subscriptionId: string,
) {
  await firestore.collection("push_subscriptions").doc(subscriptionId).delete()
}
