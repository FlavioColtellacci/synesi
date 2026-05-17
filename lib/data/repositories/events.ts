import type { SupabaseClient } from "@supabase/supabase-js"
import type { Firestore } from "firebase-admin/firestore"
import type { Database } from "@/types/database"
import { newDocumentId, toFirestorePayload } from "@/lib/data/firestore-utils"

type EventRow = Database["public"]["Tables"]["events"]["Row"]
type EventInsert = Database["public"]["Tables"]["events"]["Insert"]
type EventUpdate = Database["public"]["Tables"]["events"]["Update"]

export type ChallengeEventRow = Pick<EventRow, "id" | "thesis_id" | "event_detail" | "created_at">

export type MonitorEventLoadRow = Pick<
  EventRow,
  "thesis_id" | "event_type" | "event_detail" | "created_at"
>

export type EventRepository = {
  listUnreviewedByUserId(userId: string): Promise<ChallengeEventRow[]>
  listChallengeByThesisId(userId: string, thesisId: string): Promise<ChallengeEventRow[]>
  listMonitorEventsByUserId(userId: string, limit?: number): Promise<MonitorEventLoadRow[]>
  markReviewed(userId: string, eventId: string): Promise<boolean>
  insertMany(values: EventInsert[]): Promise<void>
  update(userId: string, eventId: string, values: EventUpdate): Promise<boolean>
}

function normalizeEventRow(eventId: string, data: Record<string, unknown>): EventRow {
  const nowIso = new Date().toISOString()
  return {
    id: eventId,
    thesis_id: typeof data.thesis_id === "string" ? data.thesis_id : "",
    user_id: typeof data.user_id === "string" ? data.user_id : "",
    event_type: typeof data.event_type === "string" ? data.event_type : "",
    event_detail: typeof data.event_detail === "string" ? data.event_detail : null,
    is_reviewed: typeof data.is_reviewed === "boolean" ? data.is_reviewed : false,
    created_at: typeof data.created_at === "string" ? data.created_at : nowIso,
  }
}

export function createSupabaseEventRepository(supabase: SupabaseClient<Database>): EventRepository {
  return {
    async listUnreviewedByUserId(userId) {
      const { data, error } = await supabase
        .from("events")
        .select("id, thesis_id, event_detail, created_at")
        .eq("user_id", userId)
        .eq("is_reviewed", false)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data ?? []
    },
    async listChallengeByThesisId(userId, thesisId) {
      const { data, error } = await supabase
        .from("events")
        .select("id, thesis_id, event_detail, created_at")
        .eq("thesis_id", thesisId)
        .eq("user_id", userId)
        .eq("event_type", "trusted_source_challenge")
        .eq("is_reviewed", false)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data ?? []
    },
    async listMonitorEventsByUserId(userId, limit = 40) {
      const { data, error } = await supabase
        .from("events")
        .select("thesis_id, event_type, event_detail, created_at")
        .eq("user_id", userId)
        .eq("is_reviewed", false)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (error) throw error
      return data ?? []
    },
    async markReviewed(userId, eventId) {
      const { data, error } = await supabase
        .from("events")
        .update({ is_reviewed: true })
        .eq("id", eventId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle()

      if (error) throw error
      return Boolean(data)
    },
    async insertMany(values) {
      if (values.length === 0) return
      const { error } = await supabase.from("events").insert(values)
      if (error) throw error
    },
    async update(userId, eventId, values) {
      const { data, error } = await supabase
        .from("events")
        .update(values)
        .eq("id", eventId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle()

      if (error) throw error
      return Boolean(data)
    },
  }
}

export function createFirebaseEventRepository(firestore: Firestore): EventRepository {
  const events = firestore.collection("events")

  return {
    async listUnreviewedByUserId(userId) {
      const snapshot = await events
        .where("user_id", "==", userId)
        .where("is_reviewed", "==", false)
        .orderBy("created_at", "desc")
        .get()

      return snapshot.docs.map((doc) => {
        const row = normalizeEventRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>)
        return {
          id: row.id,
          thesis_id: row.thesis_id,
          event_detail: row.event_detail,
          created_at: row.created_at,
        }
      })
    },
    async listChallengeByThesisId(userId, thesisId) {
      const snapshot = await events
        .where("thesis_id", "==", thesisId)
        .where("user_id", "==", userId)
        .where("event_type", "==", "trusted_source_challenge")
        .where("is_reviewed", "==", false)
        .orderBy("created_at", "desc")
        .get()

      return snapshot.docs.map((doc) => {
        const row = normalizeEventRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>)
        return {
          id: row.id,
          thesis_id: row.thesis_id,
          event_detail: row.event_detail,
          created_at: row.created_at,
        }
      })
    },
    async listMonitorEventsByUserId(userId, limit = 40) {
      const snapshot = await events
        .where("user_id", "==", userId)
        .where("is_reviewed", "==", false)
        .orderBy("created_at", "desc")
        .limit(limit)
        .get()

      return snapshot.docs.map((doc) => {
        const row = normalizeEventRow(doc.id, (doc.data() ?? {}) as Record<string, unknown>)
        return {
          thesis_id: row.thesis_id,
          event_type: row.event_type,
          event_detail: row.event_detail,
          created_at: row.created_at,
        }
      })
    },
    async markReviewed(userId, eventId) {
      const ref = events.doc(eventId)
      const snapshot = await ref.get()
      if (!snapshot.exists) return false

      const row = normalizeEventRow(eventId, (snapshot.data() ?? {}) as Record<string, unknown>)
      if (row.user_id !== userId) return false

      await ref.set({ is_reviewed: true }, { merge: true })
      return true
    },
    async insertMany(values) {
      if (values.length === 0) return

      const batch = firestore.batch()
      const nowIso = new Date().toISOString()

      for (const value of values) {
        const eventId = value.id ?? newDocumentId()
        const ref = events.doc(eventId)
        batch.set(
          ref,
          toFirestorePayload({
            ...value,
            id: eventId,
            is_reviewed: value.is_reviewed ?? false,
            created_at: value.created_at ?? nowIso,
          }),
        )
      }

      await batch.commit()
    },
    async update(userId, eventId, values) {
      const ref = events.doc(eventId)
      const snapshot = await ref.get()
      if (!snapshot.exists) return false

      const row = normalizeEventRow(eventId, (snapshot.data() ?? {}) as Record<string, unknown>)
      if (row.user_id !== userId) return false

      await ref.set(toFirestorePayload(values as Record<string, unknown>), { merge: true })
      return true
    },
  }
}
