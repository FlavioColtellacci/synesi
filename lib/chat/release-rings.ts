export type SigmaReleaseRing = "internal" | "beta" | "full"

const RING_ORDER: SigmaReleaseRing[] = ["internal", "beta", "full"]

function parseCsvSet(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )
}

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase()
}

function normalizeUserId(userId: string) {
  return userId.trim().toLowerCase()
}

export function resolveReleaseRing(args: { userId: string; email?: string | null }): SigmaReleaseRing {
  const internalAllowlist = parseCsvSet(process.env.SIGMA_RELEASE_RING_INTERNAL_USERS)
  const betaAllowlist = parseCsvSet(process.env.SIGMA_RELEASE_RING_BETA_USERS)
  const email = normalizeEmail(args.email)
  const userId = normalizeUserId(args.userId)

  if (internalAllowlist.has(userId) || (email && internalAllowlist.has(email))) {
    return "internal"
  }
  if (betaAllowlist.has(userId) || (email && betaAllowlist.has(email))) {
    return "beta"
  }
  return "full"
}

export function readRolloutTargetRing(envValue: string | undefined, fallback: SigmaReleaseRing): SigmaReleaseRing {
  const normalized = (envValue ?? "").trim().toLowerCase()
  if (normalized === "internal" || normalized === "beta" || normalized === "full") {
    return normalized
  }
  return fallback
}

function ringRank(ring: SigmaReleaseRing) {
  return RING_ORDER.indexOf(ring)
}

/**
 * Rollout progression:
 * - internal target -> internal users only
 * - beta target -> internal + beta users
 * - full target -> all users
 */
export function isRingIncludedInRollout(args: { userRing: SigmaReleaseRing; targetRing: SigmaReleaseRing }) {
  return ringRank(args.userRing) <= ringRank(args.targetRing)
}

