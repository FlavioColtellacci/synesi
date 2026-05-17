import type { SupabaseClient } from "@supabase/supabase-js"
import type { Firestore } from "firebase-admin/firestore"
import type { Database } from "@/types/database"
import { newDocumentId, toFirestorePayload } from "@/lib/data/firestore-utils"

type ThesisRow = Database["public"]["Tables"]["theses"]["Row"]
type ThesisInsert = Database["public"]["Tables"]["theses"]["Insert"]
type ThesisUpdate = Database["public"]["Tables"]["theses"]["Update"]

export type DashboardThesisRow = Pick<
  ThesisRow,
  | "id"
  | "ticker"
  | "company_name"
  | "status"
  | "confidence_level"
  | "created_at"
  | "updated_at"
  | "thesis_statement"
>

export type ThesisRepository = {
  listNonBrokenTickers(): Promise<string[]>
  listDashboardByUserId(userId: string): Promise<DashboardThesisRow[]>
  getById(userId: string, thesisId: string): Promise<ThesisRow | null>
  getOwnership(userId: string, thesisId: string): Promise<Pick<ThesisRow, "id" | "user_id" | "status"> | null>
  create(values: ThesisInsert): Promise<string>
  update(userId: string, thesisId: string, values: ThesisUpdate): Promise<void>
  updateStatus(userId: string, thesisId: string, status: string): Promise<string | null>
  delete(userId: string, thesisId: string): Promise<boolean>
}

function normalizeThesisRow(thesisId: string, data: Record<string, unknown>): ThesisRow {
  const nowIso = new Date().toISOString()
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
    created_at: typeof data.created_at === "string" ? data.created_at : nowIso,
    updated_at: typeof data.updated_at === "string" ? data.updated_at : nowIso,
  }
}

function asUniqueTickers(rows: Array<{ ticker: string }>): string[] {
  const unique = new Set<string>()
  for (const row of rows) {
    const ticker = row.ticker.trim().toUpperCase()
    if (ticker) unique.add(ticker)
  }
  return Array.from(unique)
}

export function createSupabaseThesisRepository(
  supabase: SupabaseClient<Database>,
): ThesisRepository {
  return {
    async listNonBrokenTickers() {
      const { data, error } = await supabase
        .from("theses")
        .select("ticker")
        .neq("status", "broken")

      if (error) throw error
      return asUniqueTickers(data ?? [])
    },
    async listDashboardByUserId(userId) {
      const { data, error } = await supabase
        .from("theses")
        .select(
          "id, ticker, company_name, status, confidence_level, created_at, updated_at, thesis_statement",
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })

      if (error) throw error
      return data ?? []
    },
    async getById(userId, thesisId) {
      const { data, error } = await supabase
        .from("theses")
        .select("*")
        .eq("id", thesisId)
        .eq("user_id", userId)
        .maybeSingle()

      if (error) throw error
      return data ?? null
    },
    async getOwnership(userId, thesisId) {
      const { data, error } = await supabase
        .from("theses")
        .select("id, user_id, status")
        .eq("id", thesisId)
        .eq("user_id", userId)
        .maybeSingle()

      if (error) throw error
      return data ?? null
    },
    async create(values) {
      const { data, error } = await supabase.from("theses").insert(values).select("id").single()
      if (error) throw error
      return data.id
    },
    async update(userId, thesisId, values) {
      const { error } = await supabase
        .from("theses")
        .update(values)
        .eq("id", thesisId)
        .eq("user_id", userId)

      if (error) throw error
    },
    async updateStatus(userId, thesisId, status) {
      const thesis = await this.getOwnership(userId, thesisId)
      if (!thesis) return null

      await this.update(userId, thesisId, {
        status,
        updated_at: new Date().toISOString(),
      })
      return thesis.status
    },
    async delete(userId, thesisId) {
      const thesis = await this.getOwnership(userId, thesisId)
      if (!thesis) return false

      const { error } = await supabase.from("theses").delete().eq("id", thesisId).eq("user_id", userId)
      if (error) throw error
      return true
    },
  }
}

const THESIS_CHILD_COLLECTIONS = [
  "assumptions",
  "thesis_updates",
  "events",
  "trusted_sources",
  "alert_rules",
  "alert_rule_sources",
  "thesis_source_matches",
] as const

async function deleteFirestoreByThesisId(
  firestore: Firestore,
  collectionName: string,
  thesisId: string,
) {
  const snapshot = await firestore.collection(collectionName).where("thesis_id", "==", thesisId).get()
  if (snapshot.empty) return

  const batch = firestore.batch()
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref)
  }
  await batch.commit()
}

const ACTIVE_THESIS_STATUSES = ["intact", "at_risk"] as const

export function createFirebaseThesisRepository(firestore: Firestore): ThesisRepository {
  const theses = firestore.collection("theses")

  return {
    async listNonBrokenTickers() {
      const snapshot = await theses.where("status", "in", [...ACTIVE_THESIS_STATUSES]).get()
      return asUniqueTickers(
        snapshot.docs.map((doc) => {
          const data = (doc.data() ?? {}) as Record<string, unknown>
          return { ticker: typeof data.ticker === "string" ? data.ticker : "" }
        }),
      )
    },
    async listDashboardByUserId(userId) {
      const snapshot = await theses
        .where("user_id", "==", userId)
        .orderBy("updated_at", "desc")
        .get()

      return snapshot.docs.map((doc) => {
        const row = normalizeThesisRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>)
        return {
          id: row.id,
          ticker: row.ticker,
          company_name: row.company_name,
          status: row.status,
          confidence_level: row.confidence_level,
          created_at: row.created_at,
          updated_at: row.updated_at,
          thesis_statement: row.thesis_statement,
        }
      })
    },
    async getById(userId, thesisId) {
      const snapshot = await theses.doc(thesisId).get()
      if (!snapshot.exists) return null
      const row = normalizeThesisRow(thesisId, (snapshot.data() ?? {}) as Record<string, unknown>)
      return row.user_id === userId ? row : null
    },
    async getOwnership(userId, thesisId) {
      const row = await this.getById(userId, thesisId)
      if (!row) return null
      return { id: row.id, user_id: row.user_id, status: row.status }
    },
    async create(values) {
      const thesisId = values.id ?? newDocumentId()
      const nowIso = new Date().toISOString()
      const payload = toFirestorePayload({
        ...values,
        id: thesisId,
        status: values.status ?? "intact",
        created_at: values.created_at ?? nowIso,
        updated_at: values.updated_at ?? nowIso,
      })

      await theses.doc(thesisId).set(payload)
      return thesisId
    },
    async update(userId, thesisId, values) {
      const existing = await this.getOwnership(userId, thesisId)
      if (!existing) return

      const payload = toFirestorePayload({
        ...values,
        updated_at: values.updated_at ?? new Date().toISOString(),
      })
      delete payload.id
      delete payload.user_id

      await theses.doc(thesisId).set(payload, { merge: true })
    },
    async updateStatus(userId, thesisId, status) {
      const thesis = await this.getOwnership(userId, thesisId)
      if (!thesis) return null

      const oldStatus = thesis.status
      await this.update(userId, thesisId, {
        status,
        updated_at: new Date().toISOString(),
      })
      return oldStatus
    },
    async delete(userId, thesisId) {
      const existing = await this.getOwnership(userId, thesisId)
      if (!existing) return false

      await Promise.all(
        THESIS_CHILD_COLLECTIONS.map((collectionName) =>
          deleteFirestoreByThesisId(firestore, collectionName, thesisId),
        ),
      )
      await theses.doc(thesisId).delete()
      return true
    },
  }
}
