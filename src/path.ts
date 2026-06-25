import { matchSupportedLocale, normalizeLocaleCode } from './utils'

export const defaultIgnorePaths: Array<RegExp | string> = [
  /^\/assets\//,
  /^\/build\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/manifest\.webmanifest$/,
  /^\/api\//,
]

export function isIgnoredPath(pathname: string, ignorePaths: Array<RegExp | string> = defaultIgnorePaths): boolean {
  return ignorePaths.some((pattern) => (typeof pattern === 'string' ? pathname.startsWith(pattern) : pattern.test(pathname)))
}

const ISO_639_1 = new Set([
  'aa', 'ab', 'ae', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az',
  'ba', 'be', 'bg', 'bh', 'bi', 'bm', 'bn', 'bo', 'br', 'bs',
  'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy',
  'da', 'de', 'dv', 'dz',
  'ee', 'el', 'en', 'eo', 'es', 'et', 'eu',
  'fa', 'ff', 'fi', 'fj', 'fo', 'fr', 'fy',
  'ga', 'gd', 'gl', 'gn', 'gu', 'gv',
  'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz',
  'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it', 'iu',
  'ja', 'jv',
  'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko', 'kr', 'ks', 'ku', 'kv', 'kw', 'ky',
  'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv',
  'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my',
  'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny',
  'oc', 'oj', 'om', 'or', 'os',
  'pa', 'pi', 'pl', 'ps', 'pt',
  'qu',
  'rm', 'rn', 'ro', 'ru', 'rw',
  'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw',
  'ta', 'te', 'tg', 'th', 'ti', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty',
  'ug', 'uk', 'ur', 'uz',
  've', 'vi', 'vo',
  'wa', 'wo',
  'xh',
  'yi', 'yo',
  'za', 'zh', 'zu'
])

const EXCLUDED_CODES = new Set([
  'am', 'an', 'as', 'co', 'he', 'in', 'is', 'it', 'no', 'on', 'so', 'to', 'we'
])

export function looksLikeLocale(segment: string): boolean {
  if (!/^[a-z]{2}(?:-[a-z0-9]{2,8})*$/i.test(segment)) {
    return false
  }
  if (segment.includes('-')) {
    return true
  }
  const base = segment.toLowerCase()
  return ISO_639_1.has(base) && !EXCLUDED_CODES.has(base)
}

export function rewriteLocalePath(
  path: string,
  targetLocale: string,
  supportedLocales: readonly string[],
  options: { defaultLocale?: string; prefixDefaultLocale?: boolean; ignorePaths?: Array<RegExp | string> } = {},
): string {
  const url = new URL(path, 'https://example.com')
  if (isIgnoredPath(url.pathname, options.ignorePaths ?? defaultIgnorePaths)) return `${url.pathname}${url.search}${url.hash}`

  const target = matchSupportedLocale(targetLocale, supportedLocales, options.defaultLocale ?? supportedLocales[0]!)
  const prefixDefaultLocale = options.prefixDefaultLocale ?? true
  const defaultLocale = options.defaultLocale ? normalizeLocaleCode(options.defaultLocale) : undefined
  const segments = url.pathname.split('/').filter(Boolean)
  const first = segments[0]
  const firstSupported = first ? matchSupportedLocale(first, supportedLocales, '') : ''

  if (first && (firstSupported || looksLikeLocale(first))) segments.shift()

  const shouldPrefix = !(prefixDefaultLocale === false && defaultLocale && target === defaultLocale)
  const nextSegments = shouldPrefix ? [target, ...segments] : segments
  const pathname = `/${nextSegments.join('/')}`.replace(/\/$/, '') || '/'
  return `${pathname}${url.search}${url.hash}`
}
