/**
 * User-facing copy for the Sigma guide. Keep example phrases aligned with
 * resolveSkillRoute in app/api/chat/route.ts and field max lengths with
 * sanitizeMemoryText in lib/chat/store.ts.
 */

export const SIGMA_MEMORY_LIMITS = {
  investmentFocus: 180,
  monitoringPreferences: 220,
  communicationStyle: 120,
  notes: 320,
} as const

export const SKILL_ROUTE_EXAMPLES = {
  general: [
    "How do I create a thesis?",
    "Explain my dashboard in simple terms",
    "Set up personalized alerts",
  ],
  thesis_review: [
    "Review my thesis assumptions and key risks",
    "Stress test my bull case for AAPL",
    "What could break this thesis?",
  ],
  alert_triage: [
    "Triage my open alerts by urgency",
    "Which alerts need review first?",
    "What’s in my alert backlog?",
  ],
  monitor_explain: [
    "Show my latest Sigma monitor summary",
    "What changed since the last monitor run?",
    "Explain the monitor digest",
  ],
} as const
