/** Floating Sigma panel: ephemeral thread + last activity (sessionStorage). */

export const FAB_SESSION_STORAGE_KEY = "sigma-fab-session"
export const FAB_SESSION_TTL_MS = 30 * 60 * 1000

export type FabSession = { threadId: string; lastActivityAt: number }

export function readFabSession(): FabSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(FAB_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FabSession
    if (typeof parsed?.threadId !== "string" || typeof parsed?.lastActivityAt !== "number") return null
    return parsed
  } catch {
    return null
  }
}

export function writeFabSession(session: FabSession) {
  sessionStorage.setItem(FAB_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function touchFabSession() {
  const cur = readFabSession()
  if (!cur) return
  writeFabSession({ ...cur, lastActivityAt: Date.now() })
}

export function clearFabSession() {
  sessionStorage.removeItem(FAB_SESSION_STORAGE_KEY)
}

export function isFabSessionExpired(session: FabSession): boolean {
  return Date.now() - session.lastActivityAt > FAB_SESSION_TTL_MS
}

/** Clear messages on primary thread, or delete a secondary thread entirely. */
export async function expireFabThread(oldId: string, primaryId: string | null) {
  if (primaryId && oldId === primaryId) {
    const res = await fetch(`/api/chat/history?threadId=${encodeURIComponent(oldId)}`, { method: "DELETE" })
    if (!res.ok) throw new Error("clear history failed")
  } else {
    const res = await fetch(`/api/chat/threads/${oldId}`, { method: "DELETE" })
    if (!res.ok) throw new Error("delete thread failed")
  }
}
