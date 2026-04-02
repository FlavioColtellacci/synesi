const WEB_LOOKUP_INTENT_PATTERNS: RegExp[] = [
  /\b(search|find|look\s*up|lookup)\s+(the\s+)?(web|internet|online)\b/i,
  /\b(web|internet|online)\s+(search|lookup|look\s*up)\b/i,
  /\blook\s+those\s+up\s+(online|on\s+the\s+web)\b/i,
  /\b(latest|recent|today(?:'s)?|this\s+(week|month))\s+(news|headlines?|updates?)\b/i,
  /\b(news|headlines?|updates?)\s+(on|about|for)\b/i,
  /\bwhat(?:'s|\s+is)?\s+(new|latest)\s+(with|on|about)\b/i,
]

export function isWebLookupIntent(message: string) {
  const normalized = message.trim()
  if (!normalized) return false
  return WEB_LOOKUP_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))
}
