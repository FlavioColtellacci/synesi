import { describe, expect, it } from "vitest"
import {
  applyMonitorSummaryNoiseRules,
  buildSigmaMonitorDelta,
  buildSigmaMonitorSnapshotMeta,
  buildDeterministicMonitorSummary,
  dedupeStringLinesPreserveOrder,
  formatMonitorEventSignalLine,
  getSigmaMonitorDailyRunKey,
  humanizeEventTypeSlug,
  normalizeLeadingSnakeEventTypeInLine,
  parseMonitorSummaryFromModel,
  parseSigmaMonitorSignalForUi,
  reuseExistingMonitorRun,
  sanitizeHighSignalLineForDisplay,
} from "@/lib/chat/monitor-logic"
import type { SigmaMonitorSummary } from "@/lib/chat/monitor-types"

const baseFallback: SigmaMonitorSummary = {
  headline: "Fallback headline",
  summary: "Fallback summary body for tests.",
  riskLevel: "stable",
  highSignalChanges: ["A", "B"],
  recommendedActions: [],
  evidenceSnippets: [],
}

describe("getSigmaMonitorDailyRunKey", () => {
  it("uses UTC date in run key", () => {
    const d = new Date("2026-03-15T12:00:00.000Z")
    expect(getSigmaMonitorDailyRunKey(d)).toBe("daily:2026-03-15")
  })
})

describe("reuseExistingMonitorRun", () => {
  it("reuses when a row exists and force is false", () => {
    expect(reuseExistingMonitorRun({ id: "x" }, false)).toBe(true)
  })

  it("does not reuse when forcing a fresh run", () => {
    expect(reuseExistingMonitorRun({ id: "x" }, true)).toBe(false)
  })

  it("does not reuse when no prior row", () => {
    expect(reuseExistingMonitorRun(null, false)).toBe(false)
  })
})

describe("dedupeStringLinesPreserveOrder", () => {
  it("removes duplicates case-insensitively", () => {
    const out = dedupeStringLinesPreserveOrder(["Hello", "hello", "World"], 10)
    expect(out).toEqual(["Hello", "World"])
  })
})

describe("parseMonitorSummaryFromModel", () => {
  it("parses valid JSON object from model output", () => {
    const raw = `Here is the digest:\n{"headline":"H","summary":"S","riskLevel":"stable","highSignalChanges":["one"],"recommendedActions":[],"evidenceSnippets":[]}`
    const parsed = parseMonitorSummaryFromModel(raw, baseFallback)
    expect(parsed.headline).toBe("H")
    expect(parsed.summary).toBe("S")
    expect(parsed.highSignalChanges).toEqual(["one"])
  })

  it("returns fallback when JSON is invalid", () => {
    const parsed = parseMonitorSummaryFromModel("not json {", baseFallback)
    expect(parsed).toEqual(baseFallback)
  })
})

describe("applyMonitorSummaryNoiseRules", () => {
  it("limits signal bullets when portfolio is quiet and risk is stable", () => {
    const summary: SigmaMonitorSummary = {
      ...baseFallback,
      riskLevel: "stable",
      highSignalChanges: [
        "First meaningful line for the user",
        "Second meaningful line for the user",
        "Third line should be dropped in quiet mode",
        "Fourth line should be dropped in quiet mode",
      ],
    }
    const out = applyMonitorSummaryNoiseRules(summary, { openAlertCount: 0, needsReviewCount: 0 })
    expect(out.highSignalChanges.length).toBeLessThanOrEqual(2)
  })

  it("filters very short noisy lines", () => {
    const summary: SigmaMonitorSummary = {
      ...baseFallback,
      riskLevel: "watch",
      highSignalChanges: ["short", "This is a real signal line for the user"],
    }
    const out = applyMonitorSummaryNoiseRules(summary, { openAlertCount: 1, needsReviewCount: 0 })
    expect(out.highSignalChanges).toEqual(["This is a real signal line for the user"])
  })

  it("rewrites snake_case event prefixes to title case", () => {
    const summary: SigmaMonitorSummary = {
      ...baseFallback,
      riskLevel: "watch",
      highSignalChanges: ['trusted_source_challenge: Google — "Alert title" — Ticker MSFT in title'],
    }
    const out = applyMonitorSummaryNoiseRules(summary, { openAlertCount: 1, needsReviewCount: 0 })
    expect(out.highSignalChanges[0]).toMatch(/^Trusted Source Challenge —/)
    expect(out.highSignalChanges[0]).not.toContain("trusted_source_challenge")
  })
})

describe("sanitizeHighSignalLineForDisplay", () => {
  it("strips URLs and converts pipe separators", () => {
    const raw =
      'Google | "Microsoft headline" | Ticker MSFT in title | https://news.google.com/rss/articles/long-token-here'
    expect(sanitizeHighSignalLineForDisplay(raw)).toBe(
      'Google · "Microsoft headline" · Ticker MSFT in title',
    )
  })
})

describe("humanizeEventTypeSlug", () => {
  it("title-cases snake_case event slugs", () => {
    expect(humanizeEventTypeSlug("trusted_source_challenge")).toBe("Trusted Source Challenge")
    expect(humanizeEventTypeSlug("price_move")).toBe("Price Move")
  })
})

describe("normalizeLeadingSnakeEventTypeInLine", () => {
  it("prefixes body with a title-case label", () => {
    expect(normalizeLeadingSnakeEventTypeInLine("trusted_source_challenge: hello")).toBe(
      "Trusted Source Challenge — hello",
    )
  })
})

describe("parseSigmaMonitorSignalForUi", () => {
  it("parses snake_case prefix and em-dash separated fields", () => {
    const p = parseSigmaMonitorSignalForUi(
      'trusted_source_challenge: Google — "Microsoft headline here" — Ticker MSFT found in title',
    )
    expect(p.kindLabel).toBe("Trusted Source Challenge")
    expect(p.source).toBe("Google")
    expect(p.title).toBe("Microsoft headline here")
    expect(p.detail).toBe("Ticker MSFT found in title")
  })

  it("parses normalized kind prefix lines", () => {
    const p = parseSigmaMonitorSignalForUi('Trusted Source Challenge — Google — "Hello" — match reason')
    expect(p.kindLabel).toBe("Trusted Source Challenge")
    expect(p.source).toBe("Google")
    expect(p.title).toBe("Hello")
    expect(p.detail).toBe("match reason")
  })
})

describe("formatMonitorEventSignalLine", () => {
  it("uses a human label instead of raw event_type", () => {
    const line = formatMonitorEventSignalLine({
      thesis_id: "t1",
      event_type: "trusted_source_challenge",
      event_detail: 'Google | "Hi" | match | https://example.com/x',
      created_at: "2026-01-01T00:00:00.000Z",
    })
    expect(line).toContain("Trusted Source Challenge")
    expect(line).toContain("Google")
    expect(line).not.toMatch(/https?:\/\//)
    expect(line).not.toContain("trusted_source_challenge")
  })
})

describe("buildDeterministicMonitorSummary", () => {
  it("handles empty convictions with a clear message", () => {
    const snapshot = buildSigmaMonitorSnapshotMeta([], [])
    const delta = buildSigmaMonitorDelta(null, snapshot, null)
    const out = buildDeterministicMonitorSummary([], [], [], delta, snapshot, null)
    expect(out.summary.toLowerCase()).toContain("no convictions")
    expect(out.riskLevel).toBe("stable")
  })

  it("marks critical when any thesis is broken", () => {
    const theses = [
      {
        id: "t1",
        ticker: "ACME",
        company_name: "Acme",
        status: "broken",
        updated_at: "2026-01-01T00:00:00.000Z",
        thesis_statement: "Test thesis",
      },
    ]
    const snapshot = buildSigmaMonitorSnapshotMeta(theses, [])
    const delta = buildSigmaMonitorDelta(null, snapshot, null)
    const out = buildDeterministicMonitorSummary(
      theses,
      [],
      [],
      delta,
      snapshot,
      null,
    )
    expect(out.riskLevel).toBe("critical")
    expect(out.recommendedActions.some((a) => a.actionType === "filter_needs_review")).toBe(true)
  })
})

describe("buildSigmaMonitorDelta", () => {
  it("captures new and resolved alerts plus status changes", () => {
    const previousSummary: SigmaMonitorSummary = {
      ...baseFallback,
      snapshotMeta: {
        thesisStatusById: { t1: "intact", t2: "at_risk" },
        openEventKeys: ["t1::trusted_source_challenge::a", "t2::price_move::b"],
      },
    }
    const currentMeta = buildSigmaMonitorSnapshotMeta(
      [
        {
          id: "t1",
          ticker: "AAA",
          company_name: "AAA Co",
          status: "broken",
          updated_at: "2026-01-01T00:00:00.000Z",
          thesis_statement: "thesis",
        },
      ],
      [
        {
          thesis_id: "t1",
          event_type: "trusted_source_challenge",
          event_detail: "a",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    )

    const delta = buildSigmaMonitorDelta(previousSummary, currentMeta, "daily:2026-03-30")
    expect(delta.changed).toBe(true)
    expect(delta.newAlertCount).toBe(0)
    expect(delta.resolvedAlertCount).toBe(1)
    expect(delta.statusChangeCount).toBe(1)
  })
})
