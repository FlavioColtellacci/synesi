import { NextResponse } from "next/server"
import {
  getUserSigmaMemoryProfile,
  resetUserSigmaMemoryProfile,
  updateUserSigmaMemoryProfile,
  type SigmaMemoryProfile,
} from "@/lib/chat/store"
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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const memory = await getUserSigmaMemoryProfile(supabase, user.id)
    console.info(JSON.stringify({ event: "chat_memory_read", userId: user.id, enabled: memory.enabled }))
    return NextResponse.json({ memory })
  } catch {
    return NextResponse.json({ error: "Failed to load Sigma memory profile" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (isMemoryMutationRateLimited(user.id, Date.now())) {
      return NextResponse.json({ error: "Too many memory updates. Please try again shortly." }, { status: 429 })
    }

    const body = (await request.json()) as MemoryRequestBody
    const payload = sanitizeMemoryRequestBody(body)
    const memory = await updateUserSigmaMemoryProfile(supabase, user.id, payload)
    console.info(JSON.stringify({ event: "chat_memory_updated", userId: user.id, enabled: memory.enabled }))
    return NextResponse.json({ memory })
  } catch {
    return NextResponse.json({ error: "Failed to update Sigma memory profile" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (isMemoryMutationRateLimited(user.id, Date.now())) {
      return NextResponse.json({ error: "Too many memory updates. Please try again shortly." }, { status: 429 })
    }

    const memory = await resetUserSigmaMemoryProfile(supabase, user.id)
    console.info(JSON.stringify({ event: "chat_memory_reset", userId: user.id }))
    return NextResponse.json({ memory })
  } catch {
    return NextResponse.json({ error: "Failed to reset Sigma memory profile" }, { status: 500 })
  }
}

