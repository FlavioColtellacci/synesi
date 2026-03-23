export const supabaseCookieOptions = {
  // Persist across browser restarts (365 days).
  lifetime: 60 * 60 * 24 * 365,
  path: '/',
  sameSite: 'lax' as const,
  secure: true,
}
