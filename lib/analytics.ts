export type FunnelEvent =
  | "landing_view"
  | "pricing_view"
  | "pricing_trial_expired_view"
  | "signup_start"
  | "trial_message_view"
  | "trial_upgrade_click"
  | "checkout_start"
  | "first_thesis_saved"
  | "first_ai_analysis"

export type ChatEvent =
  | "chat_widget_open"
  | "chat_message_sent"
  | "chat_response_received"
  | "chat_feedback_positive"
  | "chat_feedback_negative"
  | "chat_handoff_requested"

export type AppEvent = FunnelEvent | ChatEvent

export function trackFunnelEvent(event: FunnelEvent, properties?: Record<string, string>) {
  trackAppEvent(event, properties)
}

export function trackAppEvent(event: AppEvent, properties?: Record<string, string>) {
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
