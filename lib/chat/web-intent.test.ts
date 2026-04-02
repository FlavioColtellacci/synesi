import { describe, expect, it } from "vitest"
import { isWebLookupIntent } from "@/lib/chat/web-intent"
import { extractFirstUrl } from "@/lib/chat/web-context"

function resolveWebLookupDecision(message: string, webSearchEnabled: boolean) {
  const sharedUrl = extractFirstUrl(message)
  const webIntentMatched = isWebLookupIntent(message)
  const webLookupAttempted = webSearchEnabled && !sharedUrl && webIntentMatched
  const webLookupReasonSkipped: "toggle_off" | "url_provided" | "intent_not_matched" | null = webLookupAttempted
    ? null
    : !webSearchEnabled
      ? "toggle_off"
      : sharedUrl
        ? "url_provided"
        : "intent_not_matched"

  return { webLookupAttempted, webLookupReasonSkipped }
}

describe("web lookup intent and toggle behavior", () => {
  it("attempts web lookup when toggle is on and intent matches", () => {
    const result = resolveWebLookupDecision("Search the web for today's NVIDIA headlines.", true)
    expect(result).toEqual({
      webLookupAttempted: true,
      webLookupReasonSkipped: null,
    })
  })

  it("skips model web lookup when user already shared a URL", () => {
    const result = resolveWebLookupDecision("Find the latest updates on https://example.com/news", true)
    expect(result).toEqual({
      webLookupAttempted: false,
      webLookupReasonSkipped: "url_provided",
    })
  })

  it("skips with toggle_off when web toggle is disabled", () => {
    const result = resolveWebLookupDecision("Look up the latest earnings news for AMD online.", false)
    expect(result).toEqual({
      webLookupAttempted: false,
      webLookupReasonSkipped: "toggle_off",
    })
  })

  it("skips with intent_not_matched for normal non-web prompts", () => {
    const result = resolveWebLookupDecision("Help me triage my open conviction alerts by severity.", true)
    expect(result).toEqual({
      webLookupAttempted: false,
      webLookupReasonSkipped: "intent_not_matched",
    })
  })
})
