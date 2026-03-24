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
const isProduction = process.env.NODE_ENV === 'production'

export const supabaseCookieOptions = {
  maxAge: 60 * 60 * 24 * 400,
  path: '/',
  sameSite: 'lax' as const,
  // In local/dev we must allow non-secure cookies for http://localhost.
  // In production, keep cookies secure unless the configured app host is local.
  secure: isProduction && !isLocalHost,
}
