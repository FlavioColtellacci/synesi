'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const outputArray = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    outputArray[i] = raw.charCodeAt(i)
  }
  return outputArray
}

type SupportState = 'checking' | 'ok' | 'unsupported' | 'not_configured'

export function PushNotificationsSection() {
  const [support, setSupport] = useState<SupportState>('checking')
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setSupport('unsupported')
        return
      }
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setSupport('unsupported')
        return
      }

      const res = await fetch('/api/push/vapid-public')
      if (cancelled) return
      if (res.status === 503) {
        setSupport('not_configured')
        return
      }

      setSupport('ok')
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (!cancelled) {
        setEnabled(Boolean(sub))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  async function enablePush() {
    setHint(null)
    setBusy(true)
    try {
      const vapidRes = await fetch('/api/push/vapid-public')
      if (!vapidRes.ok) {
        setSupport('not_configured')
        setHint('Push is not configured on this server.')
        return
      }
      const { publicKey } = (await vapidRes.json()) as { publicKey?: string }
      if (!publicKey) {
        setHint('Could not load push configuration.')
        return
      }

      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setHint('Notifications are blocked. Enable them in your browser settings for this site.')
        return
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const save = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })

      if (!save.ok) {
        const err = (await save.json().catch(() => ({}))) as { error?: string }
        setHint(err.error ?? 'Could not save subscription.')
        return
      }

      setEnabled(true)
      setHint('Browser alerts enabled for this device.')
    } catch (e) {
      console.error('enablePush', e)
      setHint('Something went wrong. Try again or use another browser.')
    } finally {
      setBusy(false)
    }
  }

  async function disablePush() {
    setHint(null)
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        const json = sub.toJSON()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint }),
        })
        await sub.unsubscribe()
      }
      setEnabled(false)
      setHint('Browser alerts disabled for this device.')
    } catch (e) {
      console.error('disablePush', e)
      setHint('Could not disable. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (support === 'checking') {
    return (
      <div className="rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#6B6B7B]">Browser notifications</p>
        <p className="mt-2 font-sans text-sm text-[#6B6B7B]">Loading…</p>
      </div>
    )
  }

  if (support === 'unsupported') {
    return (
      <div className="rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#6B6B7B]">Browser notifications</p>
        <p className="mt-2 font-sans text-sm leading-relaxed text-[#6B6B7B]">
          Your browser does not support Web Push, or the site is not served over HTTPS. On iPhone/iPad, add SYNESI to
          the Home Screen (Safari) to use push after iOS 16.4.
        </p>
      </div>
    )
  }

  if (support === 'not_configured') {
    return (
      <div className="rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#6B6B7B]">Browser notifications</p>
        <p className="mt-2 font-sans text-sm leading-relaxed text-[#6B6B7B]">
          Push is not configured for this deployment (missing VAPID keys).
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#6B6B7B]">Browser notifications</p>
      <p className="mt-2 font-sans text-sm leading-relaxed text-[#A0A0A8]">
        Get notified when SYNESI creates a new alert (price moves and trusted-source matches), even when the tab is in
        the background.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {enabled ? (
          <button
            type="button"
            onClick={() => void disablePush()}
            disabled={busy}
            className="rounded-full border border-[#2A2A32] bg-transparent px-6 py-2.5 font-mono text-sm font-medium text-[#F0F0F0] transition-colors hover:bg-[#1C1C22] disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Turn off alerts'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void enablePush()}
            disabled={busy}
            className="rounded-full bg-[#FFFFFF] px-6 py-2.5 font-mono text-sm font-medium text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Enable browser alerts'}
          </button>
        )}
      </div>
      {hint ? <p className="mt-3 font-sans text-sm text-[#6B6B7B]">{hint}</p> : null}
    </div>
  )
}
