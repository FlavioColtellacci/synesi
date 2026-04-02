import { describe, expect, it } from "vitest"
import { parseAssistantResponse, parseAssistantTextFallback } from "@/lib/chat/parse"

describe("parseAssistantTextFallback", () => {
  it("recovers a usable response from non-JSON web/news prose", () => {
    const raw = `
Latest market update:
- Semiconductor demand stayed strong this quarter.
- Margin guidance was lifted by management.

Actionable takeaway: monitor demand guidance revisions on the next earnings call.
`.trim()

    expect(parseAssistantResponse(raw)).toBeNull()

    const recovered = parseAssistantTextFallback(raw)
    expect(recovered).not.toBeNull()
    expect(recovered?.answer).toContain("Latest market update")
    expect(recovered?.answer).not.toContain("I could not reliably parse that response")
    expect(recovered?.sourceTags).toEqual(["GeneralKnowledge"])
    expect(recovered?.confidence).toBe("medium")
  })

  it("normalizes markdown-heavy text fallback into readable answer text", () => {
    const raw = `
## Quick Brief
**Signal**: Earnings momentum remains intact.
1. Check revision trend.
2. Track guidance language.
`.trim()

    const recovered = parseAssistantTextFallback(raw)
    expect(recovered).not.toBeNull()
    expect(recovered?.answer).toContain("Quick Brief")
    expect(recovered?.answer).toContain("1. Check revision trend.")
    expect(recovered?.answer).not.toContain("##")
    expect(recovered?.answer).not.toContain("**")
  })
})
