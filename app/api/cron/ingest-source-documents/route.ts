import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type SourceDocumentInsert = Database["public"]["Tables"]["source_documents"]["Insert"]
type SourceType = "analyst" | "news_outlet" | "newsletter" | "sec_filing" | "other"

type MockSourceItem = {
  source_name: string
  source_type: SourceType
  url: string
  title: string
  published_at: string
  content_excerpt: string
}

// ---------------------------------------------------------------------------
// Placeholder mock items, replace with real feed adapters in Step B.
// Each item must produce a stable content_hash so re-runs stay idempotent.
// ---------------------------------------------------------------------------
function getMockSourceItems(): MockSourceItem[] {
  const today = new Date().toISOString().slice(0, 10)
  return [
    {
      source_name: "Mock Analyst Report",
      source_type: "analyst",
      url: `https://example.com/mock-analyst-${today}`,
      title: `Q1 2026 Technology Sector Overview (${today})`,
      published_at: new Date().toISOString(),
      content_excerpt:
        "Technology stocks remain resilient amid macro uncertainty. Analysts highlight strong cloud and AI spend.",
    },
    {
      source_name: "Mock News Outlet",
      source_type: "news_outlet",
      url: `https://example.com/mock-news-${today}`,
      title: `Federal Reserve Holds Rates Steady, ${today}`,
      published_at: new Date().toISOString(),
      content_excerpt:
        "The Fed signaled a cautious approach to rate adjustments, citing persistent services inflation.",
    },
  ]
}

// Deterministic hash of url + title, stable dedupe key regardless of fetch time.
function computeContentHash(url: string, title: string): string {
  return createHash("sha256").update(`${url}::${title}`).digest("hex")
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return parsed
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const maxDocsPerRun = parsePositiveInt(process.env.CRON_MAX_SOURCE_DOCS_PER_RUN, 50)
  const supabase = createAdminClient()

  const items = getMockSourceItems().slice(0, maxDocsPerRun)

  const inserted: string[] = []
  const skipped: string[] = []
  const errors: Array<{ url: string; error: string }> = []

  for (const item of items) {
    const content_hash = computeContentHash(item.url, item.title)

    const row: SourceDocumentInsert = {
      source_name: item.source_name,
      source_type: item.source_type,
      url: item.url,
      title: item.title,
      published_at: item.published_at,
      content_excerpt: item.content_excerpt,
      content_hash,
      metadata: null,
    }

    const { error } = await supabase.from("source_documents").insert(row)

    if (error) {
      // Unique constraint violation: content_hash already exists; expected dedupe path.
      if (error.code === "23505") {
        skipped.push(item.url)
      } else {
        errors.push({ url: item.url, error: error.message })
      }
    } else {
      inserted.push(item.url)
    }
  }

  return NextResponse.json({
    ok: true,
    processed: items.length,
    inserted: inserted.length,
    skipped: skipped.length,
    failed: errors.length,
    errors,
  })
}
