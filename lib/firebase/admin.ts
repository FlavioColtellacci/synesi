import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"

function parseServiceAccountEnv(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT")
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string | undefined>
    const normalized: ServiceAccount = {
      projectId: parsed.projectId ?? parsed.project_id,
      clientEmail: parsed.clientEmail ?? parsed.client_email,
      privateKey: (parsed.privateKey ?? parsed.private_key)?.replace(/\\n/g, "\n"),
    }

    if (!normalized.projectId || !normalized.clientEmail || !normalized.privateKey) {
      throw new Error("Service account JSON missing required fields")
    }

    return normalized
  } catch (error) {
    throw new Error(
      `Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

let firebaseAdminApp: App | null = null

export function getFirebaseAdminApp() {
  if (firebaseAdminApp) return firebaseAdminApp
  if (getApps().length > 0) {
    firebaseAdminApp = getApps()[0]!
    return firebaseAdminApp
  }

  const serviceAccount = parseServiceAccountEnv()
  firebaseAdminApp = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET?.trim() || undefined,
  })
  return firebaseAdminApp
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp())
}

export function getFirebaseAdminFirestore() {
  return getFirestore(getFirebaseAdminApp())
}

export function getFirebaseAdminStorage() {
  return getStorage(getFirebaseAdminApp())
}
