/**
 * Returns true when VAPID keys are set so Web Push can be used server-side.
 */
export function isWebPushConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  return Boolean(pub && priv)
}
