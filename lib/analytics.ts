export type FunnelEvent =
  | "landing_view"
  | "pricing_view"
  | "signup_start"
  | "checkout_start"
  | "first_thesis_saved"
  | "first_ai_analysis"

export function trackFunnelEvent(event: FunnelEvent, properties?: Record<string, string>) {
  if (typeof window === "undefined") return

  try {
    if (window.va) {
      window.va("event", { name: event, ...properties })
    }
  } catch {
    // analytics should never break user experience
  }
}

declare global {
  interface Window {
    va?: (command: string, payload?: Record<string, unknown>) => void
  }
}
