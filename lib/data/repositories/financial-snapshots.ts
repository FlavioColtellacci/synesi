import type { SupabaseClient } from "@supabase/supabase-js"
import type { Firestore } from "firebase-admin/firestore"
import type { Database } from "@/types/database"
import { isFirebaseBackend } from "@/lib/data/backend"
import { toFirestorePayload } from "@/lib/data/firestore-utils"
import { createAdminClient } from "@/lib/supabase/server"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"

type FinancialSnapshotRow = Database["public"]["Tables"]["financial_snapshots"]["Row"]
type FinancialSnapshotInsert = Database["public"]["Tables"]["financial_snapshots"]["Insert"]

export type FinancialSnapshotStaleRow = Pick<FinancialSnapshotRow, "ticker" | "stale_after">

export type FinancialSnapshotRepository = {
  getByTicker(ticker: string): Promise<FinancialSnapshotRow | null>
  getPayloadAndCoverageByTicker(
    ticker: string,
  ): Promise<Pick<FinancialSnapshotRow, "payload" | "coverage"> | null>
  upsert(values: FinancialSnapshotInsert): Promise<void>
  listStaleStatusByTickers(tickers: string[]): Promise<FinancialSnapshotStaleRow[]>
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function normalizeFinancialSnapshotRow(
  snapshotId: string,
  data: Record<string, unknown>,
): FinancialSnapshotRow {
  const nowIso = new Date().toISOString()
  return {
    id: snapshotId,
    ticker: typeof data.ticker === "string" ? normalizeTicker(data.ticker) : normalizeTicker(snapshotId),
    provider: typeof data.provider === "string" ? data.provider : "eodhd",
    as_of: typeof data.as_of === "string" ? data.as_of : nowIso,
    fetched_at: typeof data.fetched_at === "string" ? data.fetched_at : nowIso,
    stale_after: typeof data.stale_after === "string" ? data.stale_after : nowIso,
    payload:
      data.payload && typeof data.payload === "object" && !Array.isArray(data.payload)
        ? (data.payload as Record<string, unknown>)
        : {},
    coverage:
      data.coverage && typeof data.coverage === "object" && !Array.isArray(data.coverage)
        ? (data.coverage as Record<string, unknown>)
        : null,
  }
}

export function createSupabaseFinancialSnapshotRepository(
  supabase: SupabaseClient<Database>,
): FinancialSnapshotRepository {
  return {
    async getByTicker(ticker) {
      const normalizedTicker = normalizeTicker(ticker)
      const { data, error } = await supabase
        .from("financial_snapshots")
        .select("id, ticker, provider, as_of, fetched_at, stale_after, payload, coverage")
        .eq("ticker", normalizedTicker)
        .maybeSingle()

      if (error) throw error
      return data ?? null
    },
    async getPayloadAndCoverageByTicker(ticker) {
      const normalizedTicker = normalizeTicker(ticker)
      const { data, error } = await supabase
        .from("financial_snapshots")
        .select("payload, coverage")
        .eq("ticker", normalizedTicker)
        .maybeSingle()

      if (error) throw error
      return data ?? null
    },
    async upsert(values) {
      const { error } = await supabase
        .from("financial_snapshots")
        .upsert(values, { onConflict: "ticker" })

      if (error) throw error
    },
    async listStaleStatusByTickers(tickers) {
      if (tickers.length === 0) return []

      const normalizedTickers = Array.from(new Set(tickers.map(normalizeTicker)))
      const { data, error } = await supabase
        .from("financial_snapshots")
        .select("ticker, stale_after")
        .in("ticker", normalizedTickers)

      if (error) throw error
      return (data ?? []) as FinancialSnapshotStaleRow[]
    },
  }
}

export function createFirebaseFinancialSnapshotRepository(
  firestore: Firestore,
): FinancialSnapshotRepository {
  const snapshots = firestore.collection("financialSnapshots")

  return {
    async getByTicker(ticker) {
      const normalizedTicker = normalizeTicker(ticker)
      const snapshot = await snapshots.doc(normalizedTicker).get()
      if (!snapshot.exists) {
        return null
      }
      return normalizeFinancialSnapshotRow(
        normalizedTicker,
        (snapshot.data() ?? {}) as Record<string, unknown>,
      )
    },
    async getPayloadAndCoverageByTicker(ticker) {
      const normalizedTicker = normalizeTicker(ticker)
      const snapshot = await snapshots.doc(normalizedTicker).get()
      if (!snapshot.exists) {
        return null
      }
      const row = normalizeFinancialSnapshotRow(
        normalizedTicker,
        (snapshot.data() ?? {}) as Record<string, unknown>,
      )
      return { payload: row.payload, coverage: row.coverage }
    },
    async upsert(values) {
      const normalizedTicker = normalizeTicker(values.ticker)
      const payload = toFirestorePayload({
        ...values,
        id: values.id ?? normalizedTicker,
        ticker: normalizedTicker,
      })

      await snapshots.doc(normalizedTicker).set(payload, { merge: true })
    },
    async listStaleStatusByTickers(tickers) {
      if (tickers.length === 0) return []

      const normalizedTickers = Array.from(new Set(tickers.map(normalizeTicker)))
      const refs = normalizedTickers.map((ticker) => snapshots.doc(ticker))
      const docs = await firestore.getAll(...refs)

      return docs
        .filter((doc) => doc.exists)
        .map((doc) => {
          const row = normalizeFinancialSnapshotRow(
            doc.id,
            (doc.data() ?? {}) as Record<string, unknown>,
          )
          return { ticker: row.ticker, stale_after: row.stale_after }
        })
    },
  }
}

export function createAdminFinancialSnapshotRepository(): FinancialSnapshotRepository {
  return isFirebaseBackend()
    ? createFirebaseFinancialSnapshotRepository(getFirebaseAdminFirestore())
    : createSupabaseFinancialSnapshotRepository(createAdminClient())
}
