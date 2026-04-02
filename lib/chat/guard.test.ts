import { describe, expect, it } from "vitest"
import { enforceResponseGuardrailsWithTelemetry } from "@/lib/chat/guard"
import type { ChatAssistantResponse } from "@/lib/chat/types"

function buildResponse(answer: string): ChatAssistantResponse {
  return {
    answer,
    sourceTags: ["WorkflowGuide"],
    confidence: "high",
    escalation: "none",
    followUpActions: ["Open dashboard", "Review alerts", "Prioritize changes"],
  }
}

describe("enforceResponseGuardrailsWithTelemetry", () => {
  it("does not block normal triage/stress-test responses", () => {
    const input = buildResponse(
      "Prioritize AAPL and MSFT alerts first, then stress-test the downside assumptions for margin compression and demand risk.",
    )

    const result = enforceResponseGuardrailsWithTelemetry(input)
    expect(result.blockedByPattern).toBeNull()
    expect(result.response.answer).toContain("Prioritize AAPL and MSFT alerts")
  })

  it("does not block benign competitor analysis language", () => {
    const input = buildResponse(
      "For competitor mapping, compare product positioning and pricing strategy over the last two quarters.",
    )

    const result = enforceResponseGuardrailsWithTelemetry(input)
    expect(result.blockedByPattern).toBeNull()
    expect(result.response.answer).toContain("competitor mapping")
  })

  it("blocks clear credential leakage patterns", () => {
    const input = buildResponse("Use this api key for debugging: EXAMPLE_API_KEY_VALUE")

    const result = enforceResponseGuardrailsWithTelemetry(input)
    expect(result.blockedByPattern).toBe("credential_label")
    expect(result.response.answer).toContain("I cannot share internal or sensitive Synesi information")
  })
})
