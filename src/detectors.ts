import type { Detector, ServerDetectorContext, ClientDetectorContext } from './types'
import { matchSupportedLocale, parseCookie, parseAcceptLanguage } from './utils'

export async function runDetectors(
  detectors: readonly Detector[],
  ctx: ServerDetectorContext | ClientDetectorContext,
  supportedLocales: readonly string[],
  fallbackLocale: string,
): Promise<string> {
  for (const detector of detectors) {
    const detected = await detector.detect(ctx as never)
    if (!detected) continue
    const matched = matchSupportedLocale(detected, supportedLocales, '')
    if (matched) return matched
  }
  return fallbackLocale
}

export const serverDetectors = {
  cookie(name = 'locale'): Detector<'server'> {
    return { kind: 'server', detect: ({ request }) => parseCookie(request.headers.get('Cookie'), name) }
  },
  acceptLanguage(): Detector<'server'> {
    return { kind: 'server', detect: ({ request }) => parseAcceptLanguage(request.headers.get('Accept-Language')) }
  },
  custom(detector: Omit<Detector<'server'>, 'kind'>): Detector<'server'> {
    return { kind: 'server', ...detector }
  },
}

export const clientDetectors = {
  cookie(name = 'locale'): Detector<'client'> {
    return {
      kind: 'client',
      detect: ({ request }) => {
        if (typeof document !== 'undefined') return parseCookie(document.cookie, name)
        return parseCookie(request?.headers.get('Cookie') ?? null, name)
      },
    }
  },
  localStorage(key = 'locale'): Detector<'client'> {
    return { kind: 'client', detect: () => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)) }
  },
  navigator(): Detector<'client'> {
    return { kind: 'client', detect: () => (typeof navigator === 'undefined' ? null : navigator.language) }
  },
  custom(detector: Omit<Detector<'client'>, 'kind'>): Detector<'client'> {
    return { kind: 'client', ...detector }
  },
}
