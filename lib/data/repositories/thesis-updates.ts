import type { SupabaseClient } from "@supabase/supabase-js"
import type { Firestore } from "firebase-admin/firestore"
import type { Database } from "@/types/database"
import { newDocumentId, toFirestorePayload } from "@/lib/data/firestore-utils"

type ThesisUpdateRow = Database["public"]["Tables"]["thesis_updates"]["Row"]
type ThesisUpdateInsert = Database["public"]["Tables"]["thesis_updates"]["Insert"]

export type ThesisUpdateListRow = Pick<
  ThesisUpdateRow,
  "id" | "thesis_id" | "update_type" | "note" | "old_status" | "new_status" | "created_at"
>

export type StatusChangeNoteRow = Pick<
  ThesisUpdateRow,
  "thesis_id" | "note" | "created_at" | "new_status"
>

export type ThesisUpdateRepository = {
  insert(values: ThesisUpdateInsert): Promise<void>
  listByThesisId(userId: string, thesisId: string): Promise<ThesisUpdateListRow[]>
  listStatusChangeNotesByUserId(userId: string): Promise<StatusChangeNoteRow[]>
  countFinancialRefreshSince(userId: string, sinceIso: string): Promise<number>
}

function normalizeThesisUpdateRow(updateId: string, data: Record<string, unknown>): ThesisUpdateRow {
  const nowIso = new Date().toISOString()
  return {
    id: updateId,
    thesis_id: typeof data.thesis_id === "string" ? data.thesis_id : "",
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    update_type: typeof data.update_type === "string" ? data.update_type : "edit",
    old_status: typeof data.old_status === "string" ? data.old_status : null,
    new_status: typeof data.new_status === "string" ? data.new_status : null,
    note: typeof data.note === "string" ? data.note : null,
    created_at: typeof data.created_at === "string" ? data.created_at : nowIso,
  }
}

export function createSupabaseThesisUpdateRepository(
  supabase: SupabaseClient<Database>,
): ThesisUpdateRepository {
  return {
    async insert(values) {
      const { error } = await supabase.from("thesis_updates").insert(values)
      if (error) throw error
    },
    async listByThesisId(userId, thesisId) {
      const { data, error } = await supabase
        .from("thesis_updates")
        .select("id, update_type, note, old_status, new_status, created_at, thesis_id")
        .eq("thesis_id", thesisId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data ?? []
    },
    async listStatusChangeNotesByUserId(userId) {
      const { data, error } = await supabase
        .from("thesis_updates")
        .select("thesis_id, note, created_at, new_status")
        .eq("user_id", userId)
        .eq("update_type", "status_change")
        .not("note", "is", null)
        .order("created_at", { ascending: false })

      if (error) throw error
      return (data ?? []).filter((row): row is StatusChangeNoteRow => Boolean(row.note && row.new_status))
    },
    async countFinancialRefreshSince(userId, sinceIso) {
      const { count, error } = await supabase
        .from("thesis_updates")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("update_type", "financial_refresh")
        .gte("created_at", sinceIso)

      if (error) throw error
      return count ?? 0
    },
  }
}

export function createFirebaseThesisUpdateRepository(firestore: Firestore): ThesisUpdateRepository {
  const thesisUpdates = firestore.collection("thesis_updates")

  return {
    async insert(values) {
      const updateId = values.id ?? newDocumentId()
      const nowIso = new Date().toISOString()
      await thesisUpdates.doc(updateId).set(
        toFirestorePayload({
          ...values,
          id: updateId,
          created_at: values.created_at ?? nowIso,
        }),
      )
    },
    async listByThesisId(userId, thesisId) {
      const snapshot = await thesisUpdates
        .where("thesis_id", "==", thesisId)
        .where("user_id", "==", userId)
        .orderBy("created_at", "desc")
        .get()

      return snapshot.docs.map((doc) => {
        const row = normalizeThesisUpdateRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>)
        return {
          id: row.id,
          thesis_id: row.thesis_id,
          update_type: row.update_type,
          note: row.note,
          old_status: row.old_status,
          new_status: row.new_status,
          created_at: row.created_at,
        }
      })
    },
    async listStatusChangeNotesByUserId(userId) {
      const snapshot = await thesisUpdates
        .where("user_id", "==", userId)
        .where("update_type", "==", "status_change")
        .orderBy("created_at", "desc")
        .get()

      return snapshot.docs
        .map((doc) => normalizeThesisUpdateRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
        .filter((row) => Boolean(row.note && row.new_status))
        .map((row) => ({
          thesis_id: row.thesis_id,
          note: row.note,
          created_at: row.created_at,
          new_status: row.new_status,
        }))
    },
    async countFinancialRefreshSince(userId, sinceIso) {
      const snapshot = await thesisUpdates
        .where("user_id", "==", userId)
        .where("update_type", "==", "financial_refresh")
        .where("created_at", ">=", sinceIso)
        .get()

      return snapshot.size
    },
  }
}
