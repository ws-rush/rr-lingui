import type { LocaleInput, LocaleMeta, LinguiRouterConfig, LinguiRouter } from './types'
import { normalizeLocaleCode } from './utils'

function normalizeLocales(locales: LocaleInput): LocaleMeta[] {
  if (Array.isArray(locales)) {
    return locales.map((locale) => {
      const code = normalizeLocaleCode(locale)
      return { code, label: code, dir: 'ltr' }
    })
  }

  return Object.entries(locales).map(([locale, meta]) => {
    const code = normalizeLocaleCode(locale)
    return { code, label: meta.label ?? code, dir: meta.dir ?? 'ltr' }
  })
}

export function validateConfig(config: LinguiRouterConfig): LinguiRouter {
  const locales = normalizeLocales(config.locales)
  if (locales.length === 0) throw new Error('[lingui-rr] config.locales: cannot be empty.')

  const duplicates = new Set<string>()
  const seen = new Set<string>()
  for (const locale of locales) {
    const key = locale.code.toLowerCase()
    if (seen.has(key)) duplicates.add(locale.code)
    seen.add(key)
  }
  if (duplicates.size) throw new Error(`[lingui-rr] config.locales: duplicate locale codes: ${[...duplicates].join(', ')}`)

  const localeCodes = locales.map((locale) => locale.code)
  const defaultLocale = normalizeLocaleCode(config.defaultLocale)
  if (!localeCodes.includes(defaultLocale)) {
    throw new Error(`[lingui-rr] config.defaultLocale: "${config.defaultLocale}" is not one of locales [${localeCodes.join(', ')}].`)
  }
  const fallbackLocale = normalizeLocaleCode(config.fallbackLocale ?? defaultLocale)
  if (!localeCodes.includes(fallbackLocale)) {
    throw new Error(`[lingui-rr] config.fallbackLocale: "${config.fallbackLocale}" is not one of locales [${localeCodes.join(', ')}].`)
  }

  for (const locale of localeCodes) {
    if (!config.catalogs[locale]) throw new Error(`[lingui-rr] config.catalogs: missing catalog loader for locale "${locale}". Provide a catalog for every locale in config.locales.`)
  }

  for (const detector of config.detection ?? []) {
    if (config.server === true && detector.kind !== 'server') throw new Error(`[lingui-rr] config.detection: server: true configs can only use server detectors, got a "${detector.kind}" detector. Use serverDetectors.* instead.`)
    if (config.server === false && detector.kind !== 'client') throw new Error(`[lingui-rr] config.detection: server: false configs can only use client detectors, got a "${detector.kind}" detector. Use clientDetectors.* instead.`)
  }

  for (const persistence of config.persistence ?? []) {
    if (config.server === true && persistence.kind !== 'server') throw new Error(`[lingui-rr] config.persistence: server: true configs can only use server persistence, got a "${persistence.kind}" persistence. Use serverPersistence.* instead.`)
    if (config.server === false && persistence.kind !== 'client') throw new Error(`[lingui-rr] config.persistence: server: false configs can only use client persistence, got a "${persistence.kind}" persistence. Use clientPersistence.* instead.`)
  }

  if (config.prefixDefaultLocale !== undefined && config.mode !== 'url-prefix') {
    throw new Error(`[lingui-rr] config.prefixDefaultLocale: only valid when mode is "url-prefix", got mode "${config.mode}".`)
  }

  return { config, locales, localeCodes, defaultLocale, fallbackLocale }
}

export function createLinguiRouter(config: LinguiRouterConfig): LinguiRouter {
  return validateConfig(config)
}
