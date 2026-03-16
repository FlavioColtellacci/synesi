'use client'

import { useState } from 'react'

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      })

      const payload: { url?: string; error?: string } = await response.json()

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? 'Unable to open billing portal')
      }

      window.location.href = payload.url
    } catch (error) {
      console.error('Billing portal error:', error)
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded-full bg-[#FFFFFF] px-6 py-2.5 font-mono text-sm font-medium text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] disabled:opacity-50"
    >
      {loading ? 'Loading...' : 'MANAGE SUBSCRIPTION →'}
    </button>
  )
}
