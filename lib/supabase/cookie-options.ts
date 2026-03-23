export const supabaseCookieOptions = {
  lifetime: 60 * 60 * 24 * 365,
  path: '/',
  sameSite: 'lax' as const,
}
