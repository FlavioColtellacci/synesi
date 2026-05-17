export function toFirestorePayload(values: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      payload[key] = value
    }
  }
  return payload
}

export function newDocumentId(): string {
  return crypto.randomUUID()
}
