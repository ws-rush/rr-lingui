import type { CookieOptions } from './types'

export function normalizeLocaleCode(locale: string): string {
  return locale
    .trim()
    .split('-')
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase()
      if (index === 0) return lower
      if (part.length === 4) return lower[0]!.toUpperCase() + lower.slice(1)
      if (part.length === 2 || part.length === 3) return lower.toUpperCase()
      return lower
    })
    .join('-')
}

export function matchSupportedLocale(candidate: string | null | undefined, supportedLocales: readonly string[], fallbackLocale: string): string {
  if (!candidate) return fallbackLocale
  const supported = supportedLocales.map(normalizeLocaleCode)
  const normalized = normalizeLocaleCode(candidate)

  // 1. Try exact match first (case-insensitive)
  const exact = supported.find((locale) => locale.toLowerCase() === normalized.toLowerCase())
  if (exact) return exact

  // 2. Try progressive matching (split by hyphen and drop region/script components from the end)
  const parts = normalized.split('-')
  for (let i = parts.length - 1; i > 0; i--) {
    const sub = parts.slice(0, i).join('-').toLowerCase()
    const match = supported.find((locale) => locale.toLowerCase() === sub)
    if (match) return match
  }

  // 3. Try matching by base language (the very first segment) as a final fallback before fallbackLocale
  const base = parts[0]?.toLowerCase()
  const baseMatch = supported.find((locale) => locale.toLowerCase() === base)
  return baseMatch ?? fallbackLocale
}

export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [rawKey, ...rawValue] = part.split('=')
    const key = rawKey.trim()
    if (key === name) {
      let value = rawValue.join('=').trim()
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      return decodeURIComponent(value)
    }
  }
  return null
}

export function parseAcceptLanguage(value: string | null): string | null {
  if (!value) return null
  return value
    .split(',')
    .map((part) => {
      const [locale, ...params] = part.trim().split(';')
      const q = params.find((param) => param.trim().startsWith('q='))?.split('=')[1]
      const parsedQ = q ? Number(q) : 1
      return { locale: locale?.trim(), q: isNaN(parsedQ) ? 0 : parsedQ }
    })
    .filter((item) => item.locale && item.q > 0)
    .sort((a, b) => b.q - a.q)[0]?.locale ?? null
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? '/'}`]
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.secure) parts.push('Secure')
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.domain) parts.push(`Domain=${options.domain}`)
  return parts.join('; ')
}

export function safeRedirectPath(path: string): string {
  if (!path.startsWith('/')) return '/'
  // Remove control characters and spaces that browsers might strip/normalize,
  // then check if it is protocol-relative or backslash-based.
  const cleaned = path.replace(/[\s\u0000-\u001F\u007F-\u009F]/g, '')
  if (/^[\\/]{2}/.test(cleaned)) return '/'
  return path
}

export function appendHeaders(target: Headers, init: HeadersInit | void): void {
  if (!init) return
  new Headers(init).forEach((value, key) => target.append(key, value))
}

export function appendDataSuffix(path: string): string {
  const url = new URL(path, 'https://example.com')
  const pathname = `${url.pathname}.data`
  return `${pathname}${url.search}${url.hash}`
}
