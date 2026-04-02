import { describe, expect, it } from "vitest"
import { resolveEvalGateDecision, runChatEvalHarness } from "@/lib/chat/evals"
import type { ChatAssistantResponse } from "@/lib/chat/types"

function buildBaseResponse(): ChatAssistantResponse {
  return {
    answer: "Here is a grounded workflow summary from your uploaded files.",
    sourceTags: ["WorkflowGuide"],
    confidence: "high",
    escalation: "none",
    followUpActions: ["Review assumptions", "Open dashboard"],
    retrievalEvidence: [{ source: "uploaded_document", snippet: "Q1 revenue line from uploaded file." }],
    requestedExports: [],
    artifacts: [],
  }
}

describe("runChatEvalHarness", () => {
  it("passes on valid baseline payload", () => {
    const result = runChatEvalHarness({
      response: buildBaseResponse(),
      strictJsonMode: true,
      hadAttachments: true,
    })
    expect(result.pass).toBe(true)
  })

  it("fails policy compliance on direct trading advice", () => {
    const response = buildBaseResponse()
    response.answer = "You should buy now immediately."
    const result = runChatEvalHarness({
      response,
      strictJsonMode: true,
      hadAttachments: false,
    })
    expect(result.checks.policyCompliance).toBe(false)
    expect(result.failures).toContain("policy_compliance_failed")
  })

  it("fails document grounding when claims are not evidenced", () => {
    const response = buildBaseResponse()
    response.retrievalEvidence = [{ source: "source_match", snippet: "Generic source snippet." }]
    const result = runChatEvalHarness({
      response,
      strictJsonMode: true,
      hadAttachments: true,
    })
    expect(result.checks.documentGrounding).toBe(false)
    expect(result.failures).toContain("document_grounding_failed")
  })
})

describe("resolveEvalGateDecision", () => {
  it("does not gate when enforcement is disabled", () => {
    const evalResult = runChatEvalHarness({
      response: buildBaseResponse(),
      strictJsonMode: true,
      hadAttachments: false,
    })
    expect(resolveEvalGateDecision({ gateEnforced: false, evalResult })).toEqual({
      gated: false,
      reason: "disabled",
    })
  })

  it("gates when enforced and eval fails", () => {
    const response = buildBaseResponse()
    response.answer = "Buy now immediately."
    const evalResult = runChatEvalHarness({
      response,
      strictJsonMode: true,
      hadAttachments: false,
    })
    expect(resolveEvalGateDecision({ gateEnforced: true, evalResult })).toEqual({
      gated: true,
      reason: "failed",
    })
  })
})

