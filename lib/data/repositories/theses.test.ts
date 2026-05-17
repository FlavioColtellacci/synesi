import { describe, expect, it } from "vitest"
import { createFirebaseThesisRepository } from "@/lib/data/repositories/theses"

type DocRecord = {
  id: string
  data: Record<string, unknown>
}

class FakeFirestore {
  private readonly docs = new Map<string, DocRecord>()

  collection(name: string) {
    const prefix = `${name}/`
    return {
      doc: (id: string) => ({
        get: async () => {
          const key = `${prefix}${id}`
          const record = this.docs.get(key)
          return {
            exists: Boolean(record),
            id,
            data: () => record?.data,
          }
        },
        set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
          const key = `${prefix}${id}`
          const existing = this.docs.get(key)?.data ?? {}
          this.docs.set(key, {
            id,
            data: options?.merge ? { ...existing, ...data } : { ...data },
          })
        },
        delete: async () => {
          this.docs.delete(`${prefix}${id}`)
        },
      }),
      where: (field: string, _op: string, value: unknown) => ({
        orderBy: (_orderField: string, _direction: string) => ({
          get: async () => {
            const matches = [...this.docs.entries()]
              .filter(([key, record]) => key.startsWith(prefix) && record.data[field] === value)
              .map(([, record]) => ({
                id: record.id,
                data: () => record.data,
              }))
            return { docs: matches, empty: matches.length === 0 }
          },
        }),
      }),
    }
  }
}

describe("createFirebaseThesisRepository", () => {
  it("creates and reads a thesis for the owning user", async () => {
    const repository = createFirebaseThesisRepository(new FakeFirestore() as never)
    const thesisId = await repository.create({
      user_id: "user-1",
      ticker: "AAPL",
      company_name: "Apple",
      thesis_statement: "Quality compounder",
      confidence_level: "high",
    })

    const thesis = await repository.getById("user-1", thesisId)
    expect(thesis?.ticker).toBe("AAPL")
    expect(thesis?.status).toBe("intact")
  })

  it("returns null when a different user requests the thesis", async () => {
    const repository = createFirebaseThesisRepository(new FakeFirestore() as never)
    const thesisId = await repository.create({
      user_id: "user-1",
      ticker: "MSFT",
      company_name: "Microsoft",
      thesis_statement: "Cloud scale",
      confidence_level: "medium",
    })

    const thesis = await repository.getById("user-2", thesisId)
    expect(thesis).toBeNull()
  })

  it("returns the previous status when updating status", async () => {
    const repository = createFirebaseThesisRepository(new FakeFirestore() as never)
    const thesisId = await repository.create({
      user_id: "user-1",
      ticker: "NVDA",
      company_name: "NVIDIA",
      thesis_statement: "AI infra",
      confidence_level: "high",
      status: "intact",
    })

    const oldStatus = await repository.updateStatus("user-1", thesisId, "at_risk")
    const thesis = await repository.getById("user-1", thesisId)

    expect(oldStatus).toBe("intact")
    expect(thesis?.status).toBe("at_risk")
  })
})
