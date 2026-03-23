function getAppHostname(): string | null {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) return null
    return new URL(appUrl).hostname
  } catch {
    return null
  }
}

const appHostname = getAppHostname()
const isLocalHost =
  appHostname === 'localhost' ||
  appHostname === '127.0.0.1' ||
  appHostname === null

export const supabaseCookieOptions = {
  // Persist across browser restarts (365 days).
  lifetime: 60 * 60 * 24 * 365,
  path: '/',
  sameSite: 'lax' as const,
  secure: !isLocalHost,
  // Explicitly scope cookie to app domain in production.
  domain: !isLocalHost ? appHostname : undefined,
}
