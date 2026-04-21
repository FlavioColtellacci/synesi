import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isWebPushConfigured } from "@/lib/push/vapid"

type PushSubscriptionBody = {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

function parseSubscription(body: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  if (!body || typeof body !== "object") return null
  const raw = body as PushSubscriptionBody
  const endpoint = typeof raw.endpoint === "string" ? raw.endpoint.trim() : ""
  const p256dh = typeof raw.keys?.p256dh === "string" ? raw.keys.p256dh.trim() : ""
  const auth = typeof raw.keys?.auth === "string" ? raw.keys.auth.trim() : ""
  if (!endpoint || !p256dh || !auth) return null
  return { endpoint, p256dh, auth }
}

/**
 * Register or refresh the current browser's Web Push subscription.
 */
export async function POST(request: Request) {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push is not configured." }, { status: 503 })
  }

  const json = (await request.json().catch(() => null)) as { subscription?: unknown }
  const parsed = parseSubscription(json?.subscription)
  if (!parsed) {
    return NextResponse.json({ error: "Invalid subscription payload." }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.endpoint,
      p256dh: parsed.p256dh,
      auth: parsed.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  )

  if (error) {
    console.error("[push/subscribe] upsert failed", error.message)
    return NextResponse.json({ error: "Could not save subscription." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * Remove a subscription (typically on unsubscribe).
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const json = (await request.json().catch(() => null)) as { endpoint?: unknown }
  const endpoint = typeof json?.endpoint === "string" ? json.endpoint.trim() : ""
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint." }, { status: 400 })
  }

  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint)

  if (error) {
    console.error("[push/subscribe] delete failed", error.message)
    return NextResponse.json({ error: "Could not remove subscription." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
