import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type SourceDocumentInsert = Database["public"]["Tables"]["source_documents"]["Insert"]
type ThesisSourceMatchInsert = Database["public"]["Tables"]["thesis_source_matches"]["Insert"]
type EventInsert = Database["public"]["Tables"]["events"]["Insert"]
type AlertRuleRow = Database["public"]["Tables"]["alert_rules"]["Row"]
type ConfidenceLevel = "high" | "medium" | "low"

// ---------------------------------------------------------------------------
// Inline RSS/Atom parser (no external dependencies)
// ---------------------------------------------------------------------------

function extractTagContent(block: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tag}>`,
    "i"
  )
  const m = block.match(re)
  if (!m) return ""
  return (m[1] ?? m[2] ?? "").trim()
}

function extractAttrOrTagContent(block: string, tag: string, attr: string): string {
  const attrRe = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i")
  const attrMatch = block.match(attrRe)
  if (attrMatch) return attrMatch[1].trim()
  return extractTagContent(block, tag)
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

type FeedItem = {
  title: string
  url: string
  publishedAt: string | null
  contentExcerpt: string
}

function parseFeed(xml: string): FeedItem[] {
  const isAtom = /<feed[\s>]/i.test(xml)
  const itemTag = isAtom ? "entry" : "item"
  const itemRe = new RegExp(`<${itemTag}[\\s>][\\s\\S]*?</${itemTag}>`, "gi")
  const blocks = xml.match(itemRe) ?? []
  const items: FeedItem[] = []

  for (const block of blocks.slice(0, 20)) {
    const title = stripHtml(extractTagContent(block, "title"))
    const url = isAtom
      ? extractAttrOrTagContent(block, "link", "href")
      : extractTagContent(block, "link")

    const rawDate =
      extractTagContent(block, "pubDate") ||
      extractTagContent(block, "published") ||
      extractTagContent(block, "updated")

    let publishedAt: string | null = null
    if (rawDate) {
      const parsed = new Date(rawDate)
      if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString()
    }

    const rawContent =
      extractTagContent(block, "description") ||
      extractTagContent(block, "content:encoded") ||
      extractTagContent(block, "summary") ||
      extractTagContent(block, "content")
    const contentExcerpt = stripHtml(rawContent).slice(0, 500)

    if (!title || !url) continue
    items.push({ title, url, publishedAt, contentExcerpt })
  }
  return items
}

async function fetchFeed(feedUrl: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Synesi-Bot/1.0" },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Relevance scoring
// ---------------------------------------------------------------------------

function containsTickerToken(text: string, ticker: string): boolean {
  const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, "i").test(text)
}

const STOP_WORDS = new Set([
  "about", "after", "again", "being", "below", "could", "every", "first",
  "going", "great", "group", "having", "hence", "index", "large", "later",
  "lower", "might", "often", "other", "quite", "right", "scale", "second",
  "shall", "share", "since", "small", "still", "stock", "their", "there",
  "these", "third", "those", "under", "until", "upper", "value", "where",
  "which", "while", "would", "yield",
])

function extractSignificantWords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 5 && !STOP_WORDS.has(word)),
    ),
  ]
}

function thesisKeywordMatch(
  thesisStatement: string,
  docTitle: string,
  docExcerpt: string,
): boolean {
  const keywords = extractSignificantWords(thesisStatement)
  if (keywords.length === 0) return false
  const searchText = `${docTitle} ${docExcerpt}`
  return keywords.some((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, "i").test(searchText)
  })
}

type ScoreResult = { confidence: ConfidenceLevel; score: number; reason: string } | null

function scoreConfidence(
  ticker: string,
  companyName: string,
  docTitle: string,
  docExcerpt: string,
  thesisStatement?: string,
): ScoreResult {
  const titleLower = docTitle.toLowerCase()
  const excerptLower = docExcerpt.toLowerCase()
  const companyLower = companyName.toLowerCase()

  if (containsTickerToken(docTitle, ticker)) {
    return { confidence: "high", score: 1.0, reason: `Ticker ${ticker} found in title` }
  }
  const companyInTitle = companyLower.length > 0 && titleLower.includes(companyLower)
  const tickerInExcerpt = containsTickerToken(docExcerpt, ticker)
  if (companyInTitle || tickerInExcerpt) {
    const reason = companyInTitle
      ? `${companyName} found in title`
      : `Ticker ${ticker} found in excerpt`
    return { confidence: "medium", score: 0.6, reason }
  }
  if (companyLower.length > 0 && excerptLower.includes(companyLower)) {
    // Boost low → medium when thesis statement keywords also appear in the document.
    if (thesisStatement && thesisKeywordMatch(thesisStatement, docTitle, docExcerpt)) {
      return {
        confidence: "medium",
        score: 0.5,
        reason: `${companyName} found in excerpt with thesis keyword overlap`,
      }
    }
    return { confidence: "low", score: 0.3, reason: `${companyName} found in excerpt` }
  }
  return null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeContentHash(url: string, title: string): string {
  return createHash("sha256").update(`${url}::${title}`).digest("hex")
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return parsed
}

const CONFIDENCE_ORDER: ConfidenceLevel[] = ["high", "medium", "low"]

function meetsMinConfidence(confidence: ConfidenceLevel, min: ConfidenceLevel): boolean {
  return CONFIDENCE_ORDER.indexOf(confidence) <= CONFIDENCE_ORDER.indexOf(min)
}

function shouldEmitByRule(
  mode: AlertRuleRow["mode"],
  selectedSourceIds: Set<string>,
  matchedTrustedSourceId: string,
): boolean {
  if (mode === "exclude_sources") {
    return !selectedSourceIds.has(matchedTrustedSourceId)
  }
  return selectedSourceIds.has(matchedTrustedSourceId)
}

function normalizeKeywordMatchText(value: string): string {
  return value.toLowerCase()
}

function passesKeywordFilters(rule: AlertRuleRow, matchText: string): boolean {
  const include = rule.include_keywords ?? []
  const exclude = rule.exclude_keywords ?? []

  if (include.length > 0 && !include.some((kw) => kw && matchText.includes(kw))) {
    return false
  }

  if (exclude.length > 0 && exclude.some((kw) => kw && matchText.includes(kw))) {
    return false
  }

  return true
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type InsertedDoc = {
  docId: string
  sourceName: string
  sourceType: string
  url: string
  title: string
  contentExcerpt: string
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const maxDocsPerRun = parsePositiveInt(process.env.CRON_MAX_SOURCE_DOCS_PER_RUN, 50)
  const minConfidence = (process.env.CRON_MATCHING_MIN_CONFIDENCE ?? "high") as ConfidenceLevel
  const supabase = createAdminClient()

  // -------------------------------------------------------------------------
  // Phase 1 — Ingest
  // -------------------------------------------------------------------------
  const { data: allSources, error: sourcesError } = await supabase
    .from("trusted_sources")
    .select("id, thesis_id, user_id, name, url, source_type")
    .not("url", "is", null)

  if (sourcesError) {
    return NextResponse.json({ ok: false, error: sourcesError.message }, { status: 500 })
  }

  // Deduplicate by URL — keep first source_name/type per URL; same feed used by
  // multiple users triggers only one HTTP fetch.
  const uniqueFeeds = new Map<string, { sourceName: string; sourceType: string }>()
  for (const src of allSources ?? []) {
    if (src.url && !uniqueFeeds.has(src.url)) {
      uniqueFeeds.set(src.url, { sourceName: src.name, sourceType: src.source_type })
    }
  }

  const insertedDocs: InsertedDoc[] = []
  let docsSkipped = 0
  const fetchErrors: Array<{ feedUrl: string; error: string }> = []
  let budgetRemaining = maxDocsPerRun

  for (const [feedUrl, { sourceName, sourceType }] of uniqueFeeds) {
    if (budgetRemaining <= 0) break

    const xml = await fetchFeed(feedUrl)
    if (!xml) {
      fetchErrors.push({ feedUrl, error: "fetch failed or timed out" })
      continue
    }

    const items = parseFeed(xml)

    for (const item of items) {
      if (budgetRemaining <= 0) break

      const content_hash = computeContentHash(item.url, item.title)
      const row: SourceDocumentInsert = {
        source_name: sourceName,
        source_type: sourceType,
        url: item.url,
        title: item.title,
        published_at: item.publishedAt ?? null,
        content_excerpt: item.contentExcerpt || null,
        content_hash,
        metadata: null,
      }

      const { data: insertedRow, error } = await supabase
        .from("source_documents")
        .insert(row)
        .select("id")
        .single()

      if (error) {
        if (error.code === "23505") {
          docsSkipped++
        } else {
          fetchErrors.push({ feedUrl: item.url, error: error.message })
        }
      } else if (insertedRow) {
        insertedDocs.push({
          docId: insertedRow.id,
          sourceName,
          sourceType,
          url: item.url,
          title: item.title,
          contentExcerpt: item.contentExcerpt,
        })
        budgetRemaining--
      }
    }
  }

  const ingestionResult = {
    feedsFetched: uniqueFeeds.size,
    docsInserted: insertedDocs.length,
    docsSkipped,
    fetchErrors,
  }

  // -------------------------------------------------------------------------
  // Phase 2 — Match
  // -------------------------------------------------------------------------
  if (insertedDocs.length === 0) {
    return NextResponse.json({
      ok: true,
      ingestion: ingestionResult,
      matching: { pairsEvaluated: 0, matchesInserted: 0, matchesSkipped: 0, matchErrors: [] },
      events: { eventsCreated: 0, eventErrors: [] },
    })
  }

  const distinctSourceNames = new Set(insertedDocs.map((d) => d.sourceName.toLowerCase()))

  const { data: trustedSources } = await supabase
    .from("trusted_sources")
    .select("id, thesis_id, user_id, name")

  const matchingTrustedSources = (trustedSources ?? []).filter((ts) =>
    distinctSourceNames.has(ts.name.toLowerCase())
  )

  if (matchingTrustedSources.length === 0) {
    return NextResponse.json({
      ok: true,
      ingestion: ingestionResult,
      matching: { pairsEvaluated: 0, matchesInserted: 0, matchesSkipped: 0, matchErrors: [] },
      events: { eventsCreated: 0, eventErrors: [] },
    })
  }

  const thesisIds = [...new Set(matchingTrustedSources.map((ts) => ts.thesis_id))]

  const { data: theses } = await supabase
    .from("theses")
    .select("id, user_id, ticker, company_name, thesis_statement")
    .in("id", thesisIds)
    .neq("status", "broken")

  const thesisMap = new Map((theses ?? []).map((t) => [t.id, t]))

  let pairsEvaluated = 0
  let matchesInserted = 0
  let matchesSkipped = 0
  const matchErrors: Array<{ error: string }> = []

  type PendingEvent = {
    thesis_id: string
    user_id: string
    trusted_source_id: string
    confidence: ConfidenceLevel
    sourceName: string
    docTitle: string
    docExcerpt: string
    docUrl: string
    matchReason: string
  }
  const pendingEvents: PendingEvent[] = []

  for (const doc of insertedDocs) {
    const docSources = matchingTrustedSources.filter(
      (ts) => ts.name.toLowerCase() === doc.sourceName.toLowerCase()
    )

    for (const ts of docSources) {
      const thesis = thesisMap.get(ts.thesis_id)
      if (!thesis) continue

      pairsEvaluated++
      const scored = scoreConfidence(
        thesis.ticker,
        thesis.company_name,
        doc.title,
        doc.contentExcerpt,
        thesis.thesis_statement ?? undefined,
      )
      if (!scored) continue

      const matchRow: ThesisSourceMatchInsert = {
        user_id: ts.user_id,
        thesis_id: ts.thesis_id,
        trusted_source_id: ts.id,
        source_document_id: doc.docId,
        relevance_score: scored.score,
        match_reason: scored.reason,
        confidence: scored.confidence,
      }

      const { error: matchError } = await supabase
        .from("thesis_source_matches")
        .insert(matchRow)

      if (matchError) {
        if (matchError.code === "23505") {
          matchesSkipped++
        } else {
          matchErrors.push({ error: matchError.message })
        }
      } else {
        matchesInserted++
        // Only successful inserts are eligible for event emission — this is the
        // dedup gate: a 23505 means the match already existed, so no duplicate event.
        pendingEvents.push({
          thesis_id: ts.thesis_id,
          user_id: ts.user_id,
          trusted_source_id: ts.id,
          confidence: scored.confidence,
          sourceName: doc.sourceName,
          docTitle: doc.title,
          docExcerpt: doc.contentExcerpt,
          docUrl: doc.url,
          matchReason: scored.reason,
        })
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 3 — Events
  // -------------------------------------------------------------------------
  const eventThesisIds = [...new Set(pendingEvents.map((event) => event.thesis_id))]
  const enabledRulesByThesis = new Map<string, AlertRuleRow[]>()
  const selectedSourceIdsByRule = new Map<string, Set<string>>()

  if (eventThesisIds.length > 0) {
    const { data: enabledRules, error: enabledRulesError } = await supabase
      .from("alert_rules")
      .select(
        "id, user_id, thesis_id, name, mode, min_confidence, include_keywords, exclude_keywords, is_enabled, created_at, updated_at",
      )
      .in("thesis_id", eventThesisIds)
      .eq("is_enabled", true)

    if (enabledRulesError) {
      return NextResponse.json(
        { ok: false, error: "Failed to evaluate alert rules", details: enabledRulesError.message },
        { status: 500 },
      )
    }

    const ruleIds = (enabledRules ?? []).map((rule) => rule.id)

    if (ruleIds.length > 0) {
      const { data: ruleSources, error: ruleSourcesError } = await supabase
        .from("alert_rule_sources")
        .select("alert_rule_id, trusted_source_id")
        .in("alert_rule_id", ruleIds)

      if (ruleSourcesError) {
        return NextResponse.json(
          { ok: false, error: "Failed to evaluate alert rule sources", details: ruleSourcesError.message },
          { status: 500 },
        )
      }

      for (const sourceMapping of ruleSources ?? []) {
        const current = selectedSourceIdsByRule.get(sourceMapping.alert_rule_id) ?? new Set<string>()
        current.add(sourceMapping.trusted_source_id)
        selectedSourceIdsByRule.set(sourceMapping.alert_rule_id, current)
      }
    }

    for (const rule of enabledRules ?? []) {
      const current = enabledRulesByThesis.get(rule.thesis_id) ?? []
      current.push(rule)
      enabledRulesByThesis.set(rule.thesis_id, current)
    }
  }

  let eventsCreated = 0
  const eventErrors: Array<{ error: string }> = []

  for (const pending of pendingEvents) {
    const matchText = normalizeKeywordMatchText(
      `${pending.sourceName} ${pending.docTitle} ${pending.docExcerpt} ${pending.matchReason}`.trim(),
    )
    const thesisRules = enabledRulesByThesis.get(pending.thesis_id) ?? []
    const shouldCreateByRules =
      thesisRules.length === 0
        ? meetsMinConfidence(pending.confidence, minConfidence)
        : thesisRules.some((rule) => {
            if (!meetsMinConfidence(pending.confidence, rule.min_confidence)) return false
            const selectedSourceIds = selectedSourceIdsByRule.get(rule.id) ?? new Set<string>()
            if (!shouldEmitByRule(rule.mode, selectedSourceIds, pending.trusted_source_id)) return false
            return passesKeywordFilters(rule, matchText)
          })

    if (!shouldCreateByRules) continue

    const truncatedTitle =
      pending.docTitle.length > 120 ? pending.docTitle.slice(0, 120) + "\u2026" : pending.docTitle

    const event_detail = `${pending.sourceName} \u2014 "${truncatedTitle}" \u2014 ${pending.matchReason} \u2014 ${pending.docUrl}`

    const eventRow: EventInsert = {
      thesis_id: pending.thesis_id,
      user_id: pending.user_id,
      event_type: "trusted_source_challenge",
      event_detail,
      is_reviewed: false,
    }

    const { error: eventError } = await supabase.from("events").insert(eventRow)
    if (eventError) {
      eventErrors.push({ error: eventError.message })
    } else {
      eventsCreated++
    }
  }

  const runStats = {
    ingestion: ingestionResult,
    matching: { pairsEvaluated, matchesInserted, matchesSkipped, matchErrors },
    events: { eventsCreated, eventErrors },
  }
  console.log("[ingest-source-documents] run complete", JSON.stringify(runStats))

  return NextResponse.json({ ok: true, ...runStats })
}
