import { cookies } from "next/headers"
import { type DecodedIdToken } from "firebase-admin/auth"
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin"

const DEFAULT_SESSION_COOKIE_NAME = "__session"
const DEFAULT_SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000

export type SessionProfile = {
  subscription_status?: string | null
  trial_ends_at?: string | null
  trial_started_at?: string | null
}

function getSessionCookieName() {
  return process.env.FIREBASE_SESSION_COOKIE_NAME?.trim() || DEFAULT_SESSION_COOKIE_NAME
}

export function getSessionDurationMs() {
  const parsed = Number.parseInt(process.env.FIREBASE_SESSION_MAX_AGE_MS ?? "", 10)
  if (Number.isFinite(parsed) && parsed >= 60_000) {
    return parsed
  }
  return DEFAULT_SESSION_DURATION_MS
}

export async function createFirebaseSessionCookieFromIdToken(idToken: string) {
  const auth = getFirebaseAdminAuth()
  return auth.createSessionCookie(idToken, { expiresIn: getSessionDurationMs() })
}

export async function setFirebaseSessionCookie(sessionCookie: string) {
  const cookieStore = await cookies()
  cookieStore.set(getSessionCookieName(), sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(getSessionDurationMs() / 1000),
  })
}

export async function clearFirebaseSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(getSessionCookieName())
}

export async function verifyFirebaseSessionCookie(): Promise<DecodedIdToken | null> {
  const cookieStore = await cookies()
  const rawCookie = cookieStore.get(getSessionCookieName())?.value
  if (!rawCookie) return null

  try {
    return await getFirebaseAdminAuth().verifySessionCookie(rawCookie, true)
  } catch {
    return null
  }
}

export async function getFirebaseSessionWithProfile(): Promise<{
  token: DecodedIdToken | null
  profile: SessionProfile | null
}> {
  const token = await verifyFirebaseSessionCookie()
  if (!token) {
    return { token: null, profile: null }
  }

  try {
    const doc = await getFirebaseAdminFirestore().collection("profiles").doc(token.uid).get()
    const profile = (doc.exists ? (doc.data() as SessionProfile) : null) ?? null
    return { token, profile }
  } catch {
    return { token, profile: null }
  }
}
