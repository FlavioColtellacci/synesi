import type { SupabaseClient } from "@supabase/supabase-js"
import type { Firestore } from "firebase-admin/firestore"
import type { Database } from "@/types/database"
import { newDocumentId, toFirestorePayload } from "@/lib/data/firestore-utils"

type AssumptionRow = Database["public"]["Tables"]["assumptions"]["Row"]
type AssumptionInsert = Database["public"]["Tables"]["assumptions"]["Insert"]

export type EditableAssumptionInput = {
  category: string
  statement: string
  break_condition: string | null
}

export type AssumptionRepository = {
  listByThesisId(userId: string, thesisId: string): Promise<AssumptionRow[]>
  listEditableByThesisId(
    userId: string,
    thesisId: string,
  ): Promise<Pick<AssumptionRow, "category" | "statement" | "break_condition">[]>
  insertMany(values: AssumptionInsert[]): Promise<void>
  replaceForThesis(userId: string, thesisId: string, assumptions: EditableAssumptionInput[]): Promise<void>
}

function normalizeAssumptionRow(assumptionId: string, data: Record<string, unknown>): AssumptionRow {
  const nowIso = new Date().toISOString()
  return {
    id: assumptionId,
    thesis_id: typeof data.thesis_id === "string" ? data.thesis_id : "",
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    category: typeof data.category === "string" ? data.category : "general",
    statement: typeof data.statement === "string" ? data.statement : "",
    evidence: typeof data.evidence === "string" ? data.evidence : null,
    kpi_label: typeof data.kpi_label === "string" ? data.kpi_label : null,
    kpi_threshold: typeof data.kpi_threshold === "string" ? data.kpi_threshold : null,
    break_condition: typeof data.break_condition === "string" ? data.break_condition : null,
    sort_order: typeof data.sort_order === "number" ? data.sort_order : 0,
    created_at: typeof data.created_at === "string" ? data.created_at : nowIso,
    updated_at: typeof data.updated_at === "string" ? data.updated_at : nowIso,
  }
}

export function createSupabaseAssumptionRepository(
  supabase: SupabaseClient<Database>,
): AssumptionRepository {
  return {
    async listByThesisId(userId, thesisId) {
      const { data, error } = await supabase
        .from("assumptions")
        .select("*")
        .eq("thesis_id", thesisId)
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })

      if (error) throw error
      return data ?? []
    },
    async listEditableByThesisId(userId, thesisId) {
      const { data, error } = await supabase
        .from("assumptions")
        .select("category, statement, break_condition")
        .eq("thesis_id", thesisId)
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })

      if (error) throw error
      return data ?? []
    },
    async insertMany(values) {
      if (values.length === 0) return
      const { error } = await supabase.from("assumptions").insert(values)
      if (error) throw error
    },
    async replaceForThesis(userId, thesisId, assumptions) {
      const { error: deleteError } = await supabase
        .from("assumptions")
        .delete()
        .eq("thesis_id", thesisId)
        .eq("user_id", userId)

      if (deleteError) throw deleteError

      if (assumptions.length === 0) return

      await this.insertMany(
        assumptions.map((assumption, index) => ({
          thesis_id: thesisId,
          user_id: userId,
          category: assumption.category,
          statement: assumption.statement,
          break_condition: assumption.break_condition,
          sort_order: index,
        })),
      )
    },
  }
}

export function createFirebaseAssumptionRepository(firestore: Firestore): AssumptionRepository {
  const assumptions = firestore.collection("assumptions")

  return {
    async listByThesisId(userId, thesisId) {
      const snapshot = await assumptions
        .where("thesis_id", "==", thesisId)
        .where("user_id", "==", userId)
        .orderBy("sort_order", "asc")
        .get()

      return snapshot.docs.map((doc) =>
        normalizeAssumptionRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>),
      )
    },
    async listEditableByThesisId(userId, thesisId) {
      const rows = await this.listByThesisId(userId, thesisId)
      return rows.map((row) => ({
        category: row.category,
        statement: row.statement,
        break_condition: row.break_condition,
      }))
    },
    async insertMany(values) {
      if (values.length === 0) return

      const batch = firestore.batch()
      const nowIso = new Date().toISOString()

      for (const value of values) {
        const assumptionId = value.id ?? newDocumentId()
        const ref = assumptions.doc(assumptionId)
        batch.set(
          ref,
          toFirestorePayload({
            ...value,
            id: assumptionId,
            created_at: value.created_at ?? nowIso,
            updated_at: value.updated_at ?? nowIso,
          }),
        )
      }

      await batch.commit()
    },
    async replaceForThesis(userId, thesisId, nextAssumptions) {
      const snapshot = await assumptions
        .where("thesis_id", "==", thesisId)
        .where("user_id", "==", userId)
        .get()

      if (!snapshot.empty) {
        const batch = firestore.batch()
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref)
        }
        await batch.commit()
      }

      await this.insertMany(
        nextAssumptions.map((assumption, index) => ({
          thesis_id: thesisId,
          user_id: userId,
          category: assumption.category,
          statement: assumption.statement,
          break_condition: assumption.break_condition,
          sort_order: index,
        })),
      )
    },
  }
}
