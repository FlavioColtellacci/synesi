import { describe, expect, it } from "vitest"
import {
  countFilledMetrics,
  getMissingMetrics,
  mergeSnapshotPayloadNoRegression,
} from "@/lib/financial/refresh"
import { CORE_FINANCIAL_FIELDS, EXTENDED_FINANCIAL_FIELDS } from "@/lib/financial/types"

function basePayload() {
  return {
    price: 100,
    consensusTarget: null,
    pe: null,
    forwardPe: null,
    peg: null,
    roic: null,
    eps: null,
    fcfPerShare: null,
    marginOfSafety: null,
    rsi14: null,
    insiderActivity30d: null,
    nextEarningsDate: null,
    recentTargetChanges: [],
    indexChanges: [],
  }
}

describe("financial hybrid helpers", () => {
  it("counts core coverage using curated Tier A fields", () => {
    const payload = {
      ...basePayload(),
      consensusTarget: 120,
      pe: 22,
      forwardPe: 18,
      eps: 4.5,
      marginOfSafety: 0.2,
      nextEarningsDate: "2026-05-10",
    }

    const core = countFilledMetrics(payload, CORE_FINANCIAL_FIELDS)
    const extended = countFilledMetrics(payload, EXTENDED_FINANCIAL_FIELDS)

    expect(core.filled).toBe(7)
    expect(core.total).toBe(7)
    expect(extended.filled).toBe(0)
  })

  it("reports missing core fields from curated set", () => {
    const payload = basePayload()
    const missing = getMissingMetrics(payload, CORE_FINANCIAL_FIELDS)

    expect(missing).toContain("consensusTarget")
    expect(missing).toContain("eps")
    expect(missing).toContain("nextEarningsDate")
    expect(missing.length).toBeGreaterThan(0)
  })

  it("merges only null fields and never regresses provider values", () => {
    const provider = {
      ...basePayload(),
      price: 100,
      consensusTarget: 130,
      pe: 25,
      eps: 4.2,
    }
    const webFallback = {
      price: 98,
      consensusTarget: 140,
      pe: 24,
      forwardPe: 20,
      peg: 1.3,
      roic: 0.18,
      eps: 4.0,
      fcfPerShare: 6.1,
      rsi14: 52,
      nextEarningsDate: "2026-06-01",
    }

    const merged = mergeSnapshotPayloadNoRegression(provider, webFallback)

    expect(merged.price).toBe(100)
    expect(merged.consensusTarget).toBe(130)
    expect(merged.pe).toBe(25)
    expect(merged.forwardPe).toBe(20)
    expect(merged.peg).toBe(1.3)
    expect(merged.nextEarningsDate).toBe("2026-06-01")
    expect(merged.marginOfSafety).toBeCloseTo(0.3, 8)
  })
})

