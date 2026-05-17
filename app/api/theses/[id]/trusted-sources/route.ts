import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import {
  createTrustedSource as createFirebaseTrustedSource,
  isOwnedThesis as isOwnedFirebaseThesis,
} from "@/lib/firebase/alerting"
import { createClient } from "@/lib/supabase/server"

const VALID_SOURCE_TYPES = [
  "analyst",
  "news_outlet",
  "newsletter",
  "sec_filing",
  "other",
] as const

type SourceType = (typeof VALID_SOURCE_TYPES)[number]

function isValidSourceType(value: unknown): value is SourceType {
  return typeof value === "string" && VALID_SOURCE_TYPES.includes(value as SourceType)
}

function looksLikeFeedUrl(value: string) {
  const input = value.trim().toLowerCase()
  if (!input) return false
  return (
    input.includes("/rss") ||
    input.includes("rss.") ||
    input.includes("/feed") ||
    input.includes("atom") ||
    input.endsWith(".xml") ||
    input.includes("news.google.com/rss")
  )
}

type CreateTrustedSourcePayload = {
  name?: unknown
  url?: unknown
  sourceType?: unknown
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: thesisId } = await params
    const body = (await request.json()) as CreateTrustedSourcePayload
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const rawUrl = typeof body.url === "string" ? body.url.trim() : ""
    const sourceType = body.sourceType

    if (!name) {
      return NextResponse.json({ error: "Source name is required" }, { status: 400 })
    }

    if (!isValidSourceType(sourceType)) {
      return NextResponse.json(
        { error: "Invalid source type" },
        { status: 400 },
      )
    }

    let normalizedUrl: string | null = null
    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl)
        normalizedUrl = parsed.toString()
      } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
      }

      if (!looksLikeFeedUrl(normalizedUrl)) {
        return NextResponse.json(
          {
            error:
              "This URL doesn't look like an RSS/Atom feed. Use a direct feed URL (for example containing /rss, /feed, atom, or .xml).",
          },
          { status: 400 },
        )
      }
    }

    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isFirebaseBackend()) {
      const firestore = getFirebaseAdminFirestore()
      const thesisExists = await isOwnedFirebaseThesis(firestore, userId, thesisId)
      if (!thesisExists) {
        return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
      }

      try {
        const inserted = await createFirebaseTrustedSource(firestore, {
          thesis_id: thesisId,
          user_id: userId,
          name,
          url: normalizedUrl,
          source_type: sourceType,
        })
        return NextResponse.json({ source: inserted }, { status: 201 })
      } catch (error) {
        if (error instanceof Error && error.message === "DUPLICATE_TRUSTED_SOURCE") {
          return NextResponse.json(
            { error: "This source already exists for this thesis" },
            { status: 409 },
          )
        }
        throw error
      }
    }

    const supabase = await createClient()

    const { data: thesis } = await supabase
      .from("theses")
      .select("id")
      .eq("id", thesisId)
      .eq("user_id", userId)
      .maybeSingle()

    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    const { data: inserted, error: insertError } = await supabase
      .from("trusted_sources")
      .insert({
        thesis_id: thesisId,
        user_id: userId,
        name,
        url: normalizedUrl,
        source_type: sourceType,
      })
      .select("id, thesis_id, user_id, name, url, source_type, created_at")
      .single()

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "This source already exists for this thesis" },
          { status: 409 },
        )
      }

      throw insertError
    }

    return NextResponse.json({ source: inserted }, { status: 201 })
  } catch (error) {
    console.error("Create trusted source failed:", error)
    return NextResponse.json({ error: "Create failed" }, { status: 500 })
  }
}
