export const supabaseCookieOptions = {
  maxAge: 60 * 60 * 24 * 400,
  path: '/',
  sameSite: 'lax' as const,
}
