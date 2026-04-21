import webpush from "web-push"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { isWebPushConfigured } from "@/lib/push/vapid"

let vapidInitialized = false

function ensureVapidDetails(): boolean {
  if (!isWebPushConfigured()) {
    return false
  }
  if (vapidInitialized) {
    return true
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY!.trim()
  const subject = (process.env.VAPID_SUBJECT ?? "mailto:support@synesi.app").trim()
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidInitialized = true
  return true
}

export type AlertPushPayload = {
  title: string
  body: string
  /** Path or full URL; opened when the user clicks the notification. */
  url?: string
  /** Notification tag for collapsing duplicates in the same browser. */
  tag?: string
}

/**
 * Sends a Web Push to every registered endpoint for the user.
 * Invalid endpoints (410/404) are removed from the database.
 */
export async function sendAlertPushToUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  payload: AlertPushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!ensureVapidDetails()) {
    return { sent: 0, removed: 0 }
  }

  const { data: rows, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)

  if (error || !rows?.length) {
    return { sent: 0, removed: 0 }
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
  const defaultPath = "/app/dashboard?panel=alerts"
  let url = payload.url ?? defaultPath
  if (url.startsWith("/") && origin) {
    url = `${origin}${url}`
  }

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url,
    tag: payload.tag ?? "synesi-alert",
  })

  let sent = 0
  let removed = 0

  for (const row of rows) {
    const subscription = {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth,
      },
    }

    try {
      await webpush.sendNotification(subscription, data, {
        TTL: 3600,
        urgency: "normal",
      })
      sent += 1
    } catch (err: unknown) {
      const statusCode =
        typeof err === "object" && err !== null && "statusCode" in err
          ? Number((err as { statusCode: number }).statusCode)
          : 0
      if (statusCode === 404 || statusCode === 410) {
        const { error: delError } = await supabase.from("push_subscriptions").delete().eq("id", row.id)
        if (!delError) {
          removed += 1
        }
      } else {
        console.warn(
          JSON.stringify({
            event: "web_push_send_failed",
            userId,
            statusCode: statusCode || null,
            message: err instanceof Error ? err.message : String(err),
          }),
        )
      }
    }
  }

  return { sent, removed }
}
