import { NextResponse } from "next/server"
import { sendTrialStartedEmail } from "@/lib/email/trial"
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import {
  createFirebaseSessionCookieFromIdToken,
  setFirebaseSessionCookie,
} from "@/lib/firebase/session"

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string }
    if (!idToken || typeof idToken !== "string") {
      return jsonError("Missing idToken.", 400)
    }

    const sessionCookie = await createFirebaseSessionCookieFromIdToken(idToken)
    await setFirebaseSessionCookie(sessionCookie)

    const profile = await ensureFirebaseProfileFromIdToken(idToken)
    return NextResponse.json({ ok: true, profile })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not create session.", 401)
  }
}

async function ensureFirebaseProfileFromIdToken(idToken: string) {
  const auth = getFirebaseAdminAuth()
  const decoded = await auth.verifyIdToken(idToken)
  const user = await auth.getUser(decoded.uid)
  const profiles = getFirebaseAdminFirestore().collection("profiles")
  const ref = profiles.doc(decoded.uid)
  const snapshot = await ref.get()

  const now = new Date()
  const nowIso = now.toISOString()

  if (!snapshot.exists) {
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const doc = {
      id: decoded.uid,
      email: user.email ?? null,
      full_name: user.displayName ?? null,
      subscription_status: "inactive",
      trial_started_at: nowIso,
      trial_ends_at: trialEndsAt,
      created_at: nowIso,
      updated_at: nowIso,
    }
    await ref.set(doc)

    if (user.email) {
      try {
        await sendTrialStartedEmail({
          to: user.email,
          fullName: user.displayName ?? null,
          trialEndsAtIso: trialEndsAt,
        })
      } catch (error) {
        console.error(
          "[FirebaseSession] Trial email send failed:",
          error instanceof Error ? error.message : String(error)
        )
      }
    }

    return doc
  }

  const existing = snapshot.data() ?? {}
  if (!existing.updated_at) {
    await ref.set({ updated_at: nowIso }, { merge: true })
  }

  return existing
}
