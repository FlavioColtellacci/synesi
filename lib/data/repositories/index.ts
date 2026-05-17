import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getDataBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import {
  createFirebaseAssumptionRepository,
  createSupabaseAssumptionRepository,
} from "@/lib/data/repositories/assumptions"
import {
  createFirebaseEventRepository,
  createSupabaseEventRepository,
} from "@/lib/data/repositories/events"
import {
  createFirebaseFinancialSnapshotRepository,
  createSupabaseFinancialSnapshotRepository,
} from "@/lib/data/repositories/financial-snapshots"
import {
  createFirebaseProfileRepository,
  createSupabaseProfileRepository,
} from "@/lib/data/repositories/profiles"
import {
  createFirebaseThesisRepository,
  createSupabaseThesisRepository,
} from "@/lib/data/repositories/theses"
import {
  createFirebaseThesisUpdateRepository,
  createSupabaseThesisUpdateRepository,
} from "@/lib/data/repositories/thesis-updates"

export function createRepositories(deps: { supabase?: SupabaseClient<Database> }) {
  const backend = getDataBackend()
  if (backend === "firebase") {
    const firestore = getFirebaseAdminFirestore()
    return {
      profiles: createFirebaseProfileRepository(firestore),
      theses: createFirebaseThesisRepository(firestore),
      assumptions: createFirebaseAssumptionRepository(firestore),
      thesisUpdates: createFirebaseThesisUpdateRepository(firestore),
      events: createFirebaseEventRepository(firestore),
      financialSnapshots: createFirebaseFinancialSnapshotRepository(firestore),
    }
  }

  if (!deps.supabase) {
    throw new Error("Missing Supabase client for supabase data backend")
  }

  return {
    profiles: createSupabaseProfileRepository(deps.supabase),
    theses: createSupabaseThesisRepository(deps.supabase),
    assumptions: createSupabaseAssumptionRepository(deps.supabase),
    thesisUpdates: createSupabaseThesisUpdateRepository(deps.supabase),
    events: createSupabaseEventRepository(deps.supabase),
    financialSnapshots: createSupabaseFinancialSnapshotRepository(deps.supabase),
  }
}

export type Repositories = ReturnType<typeof createRepositories>
