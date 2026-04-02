import { describe, expect, it } from "vitest"
import { isRingIncludedInRollout, readRolloutTargetRing, resolveReleaseRing } from "@/lib/chat/release-rings"

describe("resolveReleaseRing", () => {
  it("assigns internal from allowlist", () => {
    process.env.SIGMA_RELEASE_RING_INTERNAL_USERS = "internal@example.com,user-internal"
    process.env.SIGMA_RELEASE_RING_BETA_USERS = "beta@example.com,user-beta"
    const ring = resolveReleaseRing({ userId: "user-internal", email: "other@example.com" })
    expect(ring).toBe("internal")
  })

  it("assigns beta from allowlist", () => {
    process.env.SIGMA_RELEASE_RING_INTERNAL_USERS = "internal@example.com,user-internal"
    process.env.SIGMA_RELEASE_RING_BETA_USERS = "beta@example.com,user-beta"
    const ring = resolveReleaseRing({ userId: "user-beta", email: "someone@example.com" })
    expect(ring).toBe("beta")
  })

  it("defaults to full for everyone else", () => {
    process.env.SIGMA_RELEASE_RING_INTERNAL_USERS = "internal@example.com"
    process.env.SIGMA_RELEASE_RING_BETA_USERS = "beta@example.com"
    const ring = resolveReleaseRing({ userId: "user-full", email: "full@example.com" })
    expect(ring).toBe("full")
  })
})

describe("readRolloutTargetRing", () => {
  it("falls back when unknown value is provided", () => {
    expect(readRolloutTargetRing("unknown", "beta")).toBe("beta")
  })
})

describe("isRingIncludedInRollout", () => {
  it("keeps internal-only stage restricted", () => {
    expect(isRingIncludedInRollout({ userRing: "internal", targetRing: "internal" })).toBe(true)
    expect(isRingIncludedInRollout({ userRing: "beta", targetRing: "internal" })).toBe(false)
  })

  it("opens beta stage to internal+beta", () => {
    expect(isRingIncludedInRollout({ userRing: "internal", targetRing: "beta" })).toBe(true)
    expect(isRingIncludedInRollout({ userRing: "beta", targetRing: "beta" })).toBe(true)
    expect(isRingIncludedInRollout({ userRing: "full", targetRing: "beta" })).toBe(false)
  })
})

