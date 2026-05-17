import { NextResponse } from "next/server"
import {
  getUserSigmaMemoryProfile,
  resetUserSigmaMemoryProfile,
  updateUserSigmaMemoryProfile,
  type SigmaMemoryProfile,
} from "@/lib/chat/store"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import { createClient } from "@/lib/supabase/server"

type MemoryRequestBody = {
  enabled?: boolean
  profile?: SigmaMemoryProfile["profile"]
}

const MEMORY_MUTATION_WINDOW_MS = 10 * 60 * 1000
const MEMORY_MUTATION_MAX_REQUESTS = 20
const memoryMutationRateLimit = new Map<string, number[]>()

function isMemoryMutationRateLimited(userId: string, now: number) {
  const windowStart = now - MEMORY_MUTATION_WINDOW_MS
  const hits = (memoryMutationRateLimit.get(userId) ?? []).filter((timestamp) => timestamp >= windowStart)
  hits.push(now)
  memoryMutationRateLimit.set(userId, hits)
  return hits.length > MEMORY_MUTATION_MAX_REQUESTS
}

function sanitizeMemoryRequestBody(body: MemoryRequestBody): SigmaMemoryProfile {
  return {
    enabled: body.enabled === true,
    profile: {
      investmentFocus: typeof body.profile?.investmentFocus === "string" ? body.profile.investmentFocus : undefined,
      monitoringPreferences:
        typeof body.profile?.monitoringPreferences === "string" ? body.profile.monitoringPreferences : undefined,
      communicationStyle:
        typeof body.profile?.communicationStyle === "string" ? body.profile.communicationStyle : undefined,
      notes: typeof body.profile?.notes === "string" ? body.profile.notes : undefined,
    },
  }
}

export async function GET() {
  try {
    const userId = await getServerUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const backend = isFirebaseBackend() ? getFirebaseAdminFirestore() : await createClient()
    const memory = await getUserSigmaMemoryProfile(backend, userId)
    console.info(JSON.stringify({ event: "chat_memory_read", userId, enabled: memory.enabled }))
    return NextResponse.json({ memory })
  } catch {
    return NextResponse.json({ error: "Failed to load Sigma memory profile" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getServerUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (isMemoryMutationRateLimited(userId, Date.now())) {
      return NextResponse.json({ error: "Too many memory updates. Please try again shortly." }, { status: 429 })
    }

    const backend = isFirebaseBackend() ? getFirebaseAdminFirestore() : await createClient()
    const body = (await request.json()) as MemoryRequestBody
    const payload = sanitizeMemoryRequestBody(body)
    const memory = await updateUserSigmaMemoryProfile(backend, userId, payload)
    console.info(JSON.stringify({ event: "chat_memory_updated", userId, enabled: memory.enabled }))
    return NextResponse.json({ memory })
  } catch {
    return NextResponse.json({ error: "Failed to update Sigma memory profile" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const userId = await getServerUserId()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (isMemoryMutationRateLimited(userId, Date.now())) {
      return NextResponse.json({ error: "Too many memory updates. Please try again shortly." }, { status: 429 })
    }

    const backend = isFirebaseBackend() ? getFirebaseAdminFirestore() : await createClient()
    const memory = await resetUserSigmaMemoryProfile(backend, userId)
    console.info(JSON.stringify({ event: "chat_memory_reset", userId }))
    return NextResponse.json({ memory })
  } catch {
    return NextResponse.json({ error: "Failed to reset Sigma memory profile" }, { status: 500 })
  }
}

