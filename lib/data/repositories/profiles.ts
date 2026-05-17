import type { SupabaseClient } from "@supabase/supabase-js"
import type { Firestore } from "firebase-admin/firestore"
import type { Database } from "@/types/database"

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"]
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]

export type ProfileRepository = {
  getById(userId: string): Promise<ProfileRow | null>
  upsert(values: ProfileInsert): Promise<void>
  updateByStripeCustomerId(stripeCustomerId: string, values: ProfileUpdate): Promise<void>
}

export function createSupabaseProfileRepository(
  supabase: SupabaseClient<Database>
): ProfileRepository {
  return {
    async getById(userId: string) {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
      return data ?? null
    },
    async upsert(values: ProfileInsert) {
      await supabase.from("profiles").upsert(values, { onConflict: "id" })
    },
    async updateByStripeCustomerId(stripeCustomerId: string, values: ProfileUpdate) {
      await supabase.from("profiles").update(values).eq("stripe_customer_id", stripeCustomerId)
    },
  }
}

function normalizeProfileRow(userId: string, data: Record<string, unknown>): ProfileRow {
  const nowIso = new Date().toISOString()
  return {
    id: userId,
    email: typeof data.email === "string" ? data.email : "",
    full_name: typeof data.full_name === "string" ? data.full_name : null,
    stripe_customer_id:
      typeof data.stripe_customer_id === "string" ? data.stripe_customer_id : null,
    subscription_status:
      typeof data.subscription_status === "string" ? data.subscription_status : "inactive",
    subscription_plan: typeof data.subscription_plan === "string" ? data.subscription_plan : null,
    subscription_period_end:
      typeof data.subscription_period_end === "string" ? data.subscription_period_end : null,
    trial_started_at: typeof data.trial_started_at === "string" ? data.trial_started_at : null,
    trial_ends_at: typeof data.trial_ends_at === "string" ? data.trial_ends_at : null,
    created_at: typeof data.created_at === "string" ? data.created_at : nowIso,
    updated_at: typeof data.updated_at === "string" ? data.updated_at : nowIso,
  }
}

function toFirestorePayload(values: ProfileInsert | ProfileUpdate): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      payload[key] = value
    }
  }
  return payload
}

export function createFirebaseProfileRepository(firestore: Firestore): ProfileRepository {
  const profiles = firestore.collection("profiles")

  return {
    async getById(userId: string) {
      const snapshot = await profiles.doc(userId).get()
      if (!snapshot.exists) {
        return null
      }
      return normalizeProfileRow(userId, (snapshot.data() ?? {}) as Record<string, unknown>)
    },
    async upsert(values: ProfileInsert) {
      const ref = profiles.doc(values.id)
      const snapshot = await ref.get()
      const nowIso = new Date().toISOString()
      const payload = toFirestorePayload(values)

      if (!snapshot.exists && payload.created_at === undefined) {
        payload.created_at = nowIso
      }
      if (payload.updated_at === undefined) {
        payload.updated_at = nowIso
      }
      payload.id = values.id

      await ref.set(payload, { merge: true })
    },
    async updateByStripeCustomerId(stripeCustomerId: string, values: ProfileUpdate) {
      const snapshots = await profiles
        .where("stripe_customer_id", "==", stripeCustomerId)
        .get()

      if (snapshots.empty) {
        return
      }

      const payload = toFirestorePayload(values)
      if (payload.updated_at === undefined) {
        payload.updated_at = new Date().toISOString()
      }
      delete payload.id

      await Promise.all(
        snapshots.docs.map(async (doc) => {
          await doc.ref.set(payload, { merge: true })
        })
      )
    },
  }
}
