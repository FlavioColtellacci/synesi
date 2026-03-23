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
  maxAge: 60 * 60 * 24 * 400,
  path: '/',
  sameSite: 'lax' as const,
  secure: !isLocalHost,
  domain: !isLocalHost ? appHostname : undefined,
}
