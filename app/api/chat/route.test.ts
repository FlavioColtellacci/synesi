import { describe, expect, it, vi } from "vitest"
import { runBoundedReadOnlyToolLoop } from "@/app/api/chat/route"

function createSupabaseStub() {
  return {
    from(table: string) {
      const state: Record<string, unknown> = { table }
      const query = {
        select(_columns: string) {
          return query
        },
        eq(_column: string, _value: unknown) {
          return query
        },
        ilike(_column: string, _value: string) {
          return query
        },
        order(_column: string, _opts: { ascending: boolean }) {
          return query
        },
        in(_column: string, _values: string[]) {
          if (table === "theses") {
            return Promise.resolve({
              data: [{ id: "t-1", ticker: "MSFT" }],
            })
          }
          return Promise.resolve({ data: [] })
        },
        limit(_count: number) {
          if (table === "events") {
            return Promise.resolve({
              data: [
                {
                  thesis_id: "t-1",
                  event_type: "trusted_source_challenge",
                  event_detail: "Example detail",
                  created_at: "2026-04-02T00:00:00.000Z",
                },
              ],
            })
          }
          return Promise.resolve({ data: [] })
        },
        maybeSingle() {
          return Promise.resolve({ data: null })
        },
      }
      return query
    },
  }
}

describe("runBoundedReadOnlyToolLoop", () => {
  it("routes read-only tool calls and returns final completion", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "tool-1",
            name: "list_open_alerts",
            input: { limit: 1 },
          },
        ],
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: '{"answer":"Done","sourceTags":["PolicyGuide"],"confidence":"high","escalation":"none","followUpActions":["Next step"]}',
          },
        ],
      })

    const result = await runBoundedReadOnlyToolLoop({
      llm: { messages: { create } } as unknown as ReturnType<typeof import("@/lib/llm").createLlm>,
      baseRequest: {
        model: "test-model",
        max_tokens: 500,
        system: "system",
        messages: [{ role: "user", content: "show alerts" }],
      },
      supabase: createSupabaseStub() as never,
      userId: "user-1",
      requestId: "req-1",
      attachmentIds: [],
    })

    expect(result.stats.used).toBe(true)
    expect(result.stats.toolCalls).toBe(1)
    expect(result.stats.failures).toBe(0)
    expect(result.stats.breakerTripped).toBe(false)
    expect(create).toHaveBeenCalledTimes(2)

    const secondCall = create.mock.calls[1]?.[0] as { messages: Array<{ role: string; content: unknown }> }
    const toolResultMessage = secondCall.messages[2]
    expect(toolResultMessage.role).toBe("user")
    expect(JSON.stringify(toolResultMessage.content)).toContain("tool_result")
    expect(JSON.stringify(toolResultMessage.content)).toContain("trusted_source_challenge")
  })

  it("trips circuit breaker after repeated failures and falls back", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "x1", name: "unknown_tool", input: {} }],
      })
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "x2", name: "unknown_tool", input: {} }],
      })
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "x3", name: "unknown_tool", input: {} }],
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: '{"answer":"Fallback answer","sourceTags":["PolicyGuide"],"confidence":"medium","escalation":"none","followUpActions":["retry"]}',
          },
        ],
      })

    const result = await runBoundedReadOnlyToolLoop({
      llm: { messages: { create } } as unknown as ReturnType<typeof import("@/lib/llm").createLlm>,
      baseRequest: {
        model: "test-model",
        max_tokens: 500,
        system: "system",
        messages: [{ role: "user", content: "help" }],
      },
      supabase: createSupabaseStub() as never,
      userId: "user-1",
      requestId: "req-2",
      attachmentIds: [],
    })

    expect(result.stats.failures).toBe(3)
    expect(result.stats.breakerTripped).toBe(true)
    expect(create).toHaveBeenCalledTimes(4)

    const fallbackCall = create.mock.calls[3]?.[0] as { messages: Array<{ role: string; content: string }> }
    const lastPrompt = fallbackCall.messages[fallbackCall.messages.length - 1]?.content
    expect(lastPrompt).toContain("Tool execution reached a safety limit")
  })
})
