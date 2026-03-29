const trimmed = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? ''

export const SITE_ORIGIN =
  trimmed.length > 0 ? trimmed.replace(/\/$/, '') : 'https://synesi.app'
