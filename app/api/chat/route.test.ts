import { beforeEach, describe, expect, it, vi } from "vitest"
import { createClient } from "@/lib/supabase/server"
import { POST, runBoundedReadOnlyToolLoop } from "@/app/api/chat/route"
import {
  loadChatHistoryForThread,
  persistChatExchange,
  resolveOptionalThreadIdForUser,
} from "@/lib/chat/store"
import type { ChatAssistantResponse } from "@/lib/chat/types"

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

const SAMPLE_THREAD_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
const THREAD_A = "aaaaaaaa-bbbb-cccc-dddd-aaaaaaaaaaaa"
const THREAD_B = "bbbbbbbb-bbbb-cccc-dddd-bbbbbbbbbbbb"
const PRIMARY_THREAD = "cccccccc-bbbb-cccc-dddd-cccccccccccc"

const minimalAssistantResponse = (): ChatAssistantResponse => ({
  answer: "Test answer",
  sourceTags: ["PolicyGuide"],
  confidence: "high",
  escalation: "none",
  followUpActions: [],
})

function createThreadVerifySupabase(owns: boolean) {
  return {
    from(_table: string) {
      return {
        select(_columns: string) {
          return this
        },
        eq(_column: string, _value: unknown) {
          return this
        },
        maybeSingle() {
          return Promise.resolve({ data: owns ? { id: SAMPLE_THREAD_UUID } : null, error: null })
        },
      }
    },
  }
}

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

function createAuthenticatedSupabaseForPost(ownsRequestedThread: boolean) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "test@example.com" } },
        error: null,
      }),
    },
    from(_table: string) {
      return {
        select(_columns: string) {
          return this
        },
        eq(_column: string, _value: unknown) {
          return this
        },
        maybeSingle() {
          return Promise.resolve({
            data: ownsRequestedThread ? { id: SAMPLE_THREAD_UUID } : null,
            error: null,
          })
        },
      }
    },
  }
}

/** chat_threads verify (id + user_id, no order) vs primary lookup (user_id + order + limit); chat_messages insert/history. */
function createThreadIsolationSupabase(opts: { ownedThreadIds: string[]; primaryThreadId: string }) {
  const owned = new Set(opts.ownedThreadIds)
  const insertedRows: { thread_id: string; role: string }[] = []
  let lastHistoryThreadId: string | undefined

  function chatThreadsChain() {
    const state = { idEq: undefined as string | undefined, ordered: false }
    const chain = {
      select() {
        return chain
      },
      eq(column: string, value: string) {
        if (column === "id") state.idEq = value
        return chain
      },
      order(_column: string, _opts: { ascending: boolean }) {
        state.ordered = true
        return chain
      },
      limit() {
        return chain
      },
      maybeSingle() {
        if (state.ordered) {
          return Promise.resolve({ data: { id: opts.primaryThreadId }, error: null })
        }
        if (state.idEq && owned.has(state.idEq)) {
          return Promise.resolve({ data: { id: state.idEq }, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      },
    }
    return chain
  }

  return {
    insertedRows,
    get lastHistoryThreadId() {
      return lastHistoryThreadId
    },
    client: {
      from(table: string) {
        if (table === "chat_threads") {
          return chatThreadsChain()
        }
        if (table === "chat_messages") {
          return {
            insert(rows: { thread_id: string; role: string }[]) {
              insertedRows.push(...rows)
              return Promise.resolve({ error: null })
            },
            select(_columns: string) {
              return this
            },
            eq(column: string, value: string) {
              if (column === "thread_id") lastHistoryThreadId = value
              return this
            },
            order(_column: string, _opts: { ascending: boolean }) {
              return this
            },
            limit() {
              return Promise.resolve({ data: [], error: null })
            },
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    },
  }
}

describe("resolveOptionalThreadIdForUser", () => {
  it("treats missing or blank as primary (undefined threadId)", async () => {
    const supabase = createThreadVerifySupabase(false) as never
    await expect(resolveOptionalThreadIdForUser(supabase, "user-1", undefined)).resolves.toEqual({
      ok: true,
      threadId: undefined,
    })
    await expect(resolveOptionalThreadIdForUser(supabase, "user-1", "")).resolves.toEqual({
      ok: true,
      threadId: undefined,
    })
    await expect(resolveOptionalThreadIdForUser(supabase, "user-1", "   ")).resolves.toEqual({
      ok: true,
      threadId: undefined,
    })
  })

  it("rejects invalid UUID with 400", async () => {
    const supabase = createThreadVerifySupabase(true) as never
    await expect(resolveOptionalThreadIdForUser(supabase, "user-1", "not-a-uuid")).resolves.toEqual({
      ok: false,
      status: 400,
      error: "Invalid threadId",
    })
  })

  it("rejects another user's thread with 403", async () => {
    const supabase = createThreadVerifySupabase(false) as never
    await expect(resolveOptionalThreadIdForUser(supabase, "user-1", SAMPLE_THREAD_UUID)).resolves.toEqual({
      ok: false,
      status: 403,
      error: "Chat thread not found or access denied",
    })
  })

  it("accepts owned thread UUID", async () => {
    const supabase = createThreadVerifySupabase(true) as never
    await expect(resolveOptionalThreadIdForUser(supabase, "user-1", SAMPLE_THREAD_UUID)).resolves.toEqual({
      ok: true,
      threadId: SAMPLE_THREAD_UUID,
    })
  })

  it("treats non-string threadId as primary (undefined)", async () => {
    const supabase = createThreadVerifySupabase(false) as never
    await expect(resolveOptionalThreadIdForUser(supabase, "user-1", 123)).resolves.toEqual({
      ok: true,
      threadId: undefined,
    })
    await expect(resolveOptionalThreadIdForUser(supabase, "user-1", null)).resolves.toEqual({
      ok: true,
      threadId: undefined,
    })
  })
})

describe("persistChatExchange (thread isolation)", () => {
  it("writes both messages to the explicit thread when threadId is owned", async () => {
    const stub = createThreadIsolationSupabase({
      ownedThreadIds: [THREAD_A, THREAD_B],
      primaryThreadId: PRIMARY_THREAD,
    })
    await persistChatExchange(
      stub.client as never,
      "user-1",
      "hello",
      minimalAssistantResponse(),
      THREAD_B,
    )
    expect(stub.insertedRows).toHaveLength(2)
    expect(stub.insertedRows.every((row) => row.thread_id === THREAD_B)).toBe(true)
    expect(stub.insertedRows.map((r) => r.role)).toEqual(["user", "assistant"])
  })

  it("writes to the primary thread when threadId is omitted", async () => {
    const stub = createThreadIsolationSupabase({
      ownedThreadIds: [THREAD_A],
      primaryThreadId: PRIMARY_THREAD,
    })
    await persistChatExchange(stub.client as never, "user-1", "hello", minimalAssistantResponse(), undefined)
    expect(stub.insertedRows).toHaveLength(2)
    expect(stub.insertedRows.every((row) => row.thread_id === PRIMARY_THREAD)).toBe(true)
  })

  it("rejects persistence to a thread the user does not own", async () => {
    const stub = createThreadIsolationSupabase({
      ownedThreadIds: [THREAD_A],
      primaryThreadId: PRIMARY_THREAD,
    })
    await expect(
      persistChatExchange(stub.client as never, "user-1", "hello", minimalAssistantResponse(), THREAD_B),
    ).rejects.toThrow("Chat thread not found or access denied")
    expect(stub.insertedRows).toHaveLength(0)
  })
})

describe("loadChatHistoryForThread (thread isolation)", () => {
  it("queries chat_messages for the requested thread id only", async () => {
    const stub = createThreadIsolationSupabase({
      ownedThreadIds: [THREAD_A, THREAD_B],
      primaryThreadId: PRIMARY_THREAD,
    })
    await loadChatHistoryForThread(stub.client as never, "user-1", THREAD_A, 10)
    expect(stub.lastHistoryThreadId).toBe(THREAD_A)

    const stubB = createThreadIsolationSupabase({
      ownedThreadIds: [THREAD_A, THREAD_B],
      primaryThreadId: PRIMARY_THREAD,
    })
    await loadChatHistoryForThread(stubB.client as never, "user-1", THREAD_B, 10)
    expect(stubB.lastHistoryThreadId).toBe(THREAD_B)
  })

  it("rejects loading history for a thread the user does not own", async () => {
    const stub = createThreadIsolationSupabase({
      ownedThreadIds: [THREAD_A],
      primaryThreadId: PRIMARY_THREAD,
    })
    await expect(loadChatHistoryForThread(stub.client as never, "user-1", THREAD_B, 10)).rejects.toThrow(
      "Chat thread not found or access denied",
    )
  })
})

describe("POST /api/chat threadId validation", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
  })

  it("returns 400 when threadId is not a valid UUID", async () => {
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabaseForPost(true) as never)
    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hi", threadId: "not-a-uuid" }),
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe("Invalid threadId")
  })

  it("returns 403 when threadId is valid but not owned", async () => {
    vi.mocked(createClient).mockResolvedValue(createAuthenticatedSupabaseForPost(false) as never)
    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hi", threadId: SAMPLE_THREAD_UUID }),
      }),
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe("Chat thread not found or access denied")
  })
})

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
