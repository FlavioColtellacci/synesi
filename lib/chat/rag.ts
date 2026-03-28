import type { SupabaseClient } from "@supabase/supabase-js"

type RagEvidence = {
  score: number
  text: string
}

type RagContextResult = {
  /** Top snippets injected into the model prompt (ranked; may have zero keyword overlap). */
  snippets: string[]
  /** Subset shown under “Evidence used” in the chat UI: only items with real query overlap. */
  clientEvidenceSnippets: string[]
  block: string | null
}

const MAX_SNIPPETS = 5
const MAX_SNIPPET_LENGTH = 220

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function keywordOverlapScore(query: string, text: string): number {
  const queryTokens = new Set(tokenize(query))
  if (queryTokens.size === 0) return 0

  const textTokens = tokenize(text)
  let matches = 0
  for (const token of textTokens) {
    if (queryTokens.has(token)) matches += 1
  }

  return matches / Math.max(1, Math.min(textTokens.length, 30))
}

function trimSnippet(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  if (normalized.length <= MAX_SNIPPET_LENGTH) return normalized
  return `${normalized.slice(0, MAX_SNIPPET_LENGTH - 1)}…`
}

function rankEvidence(
  query: string,
  candidates: string[],
): { promptSnippets: string[]; clientEvidenceSnippets: string[] } {
  const ranked: RagEvidence[] = candidates
    .map((text) => ({
      text: trimSnippet(text),
      score: keywordOverlapScore(query, text),
    }))
    .filter((item) => item.text.length > 0)
    .sort((a, b) => b.score - a.score)

  const top = ranked.slice(0, MAX_SNIPPETS)
  return {
    promptSnippets: top.map((item) => item.text),
    clientEvidenceSnippets: top.filter((item) => item.score > 0).map((item) => item.text),
  }
}

export async function buildRagContextBlock(
  supabase: SupabaseClient,
  userId: string,
  query: string,
): Promise<RagContextResult> {
  const [assumptionsResult, sourceMatchesResult, updatesResult] = await Promise.all([
    supabase
      .from("assumptions")
      .select("statement,evidence,break_condition,thesis_id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(120),
    supabase
      .from("thesis_source_matches")
      .select("thesis_id,match_reason,confidence,relevance_score")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("thesis_updates")
      .select("thesis_id,note,new_status")
      .eq("user_id", userId)
      .eq("update_type", "status_change")
      .order("created_at", { ascending: false })
      .limit(80),
  ])

  const candidates: string[] = []

  for (const row of assumptionsResult.data ?? []) {
    const parts = [row.statement, row.evidence, row.break_condition].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    )
    if (parts.length > 0) {
      candidates.push(`Assumption (${row.thesis_id}): ${parts.join(" | ")}`)
    }
  }

  for (const row of sourceMatchesResult.data ?? []) {
    const reason = typeof row.match_reason === "string" ? row.match_reason : "No reason provided"
    const confidence = typeof row.confidence === "string" ? row.confidence : "unknown"
    const relevance = typeof row.relevance_score === "number" ? row.relevance_score.toFixed(2) : "n/a"
    candidates.push(
      `Source match (${row.thesis_id}): ${reason} | confidence=${confidence} | relevance=${relevance}`,
    )
  }

  for (const row of updatesResult.data ?? []) {
    if (!row.note) continue
    const nextStatus = row.new_status ?? "unknown"
    candidates.push(`Status note (${row.thesis_id}): ${row.note} | status=${nextStatus}`)
  }

  const { promptSnippets, clientEvidenceSnippets } = rankEvidence(query, candidates)
  if (promptSnippets.length === 0) {
    return { snippets: [], clientEvidenceSnippets: [], block: null }
  }

  const block = [
    "SYNESI RETRIEVED EVIDENCE (user-scoped, ranked by query relevance)",
    ...promptSnippets.map((snippet) => `- ${snippet}`),
    "Use this as supporting evidence only when directly relevant. Do not claim certainty beyond these snippets.",
  ].join("\n")

  return { snippets: promptSnippets, clientEvidenceSnippets, block }
}
