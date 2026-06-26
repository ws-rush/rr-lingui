import type { Messages } from '@lingui/core'
import { redirect } from 'react-router'
import type { LinguiRouter, LinguiState, LinguiRootLoaderData, LocaleMeta, LocaleDirection, CatalogModule, CatalogLoader } from './types'
import { matchSupportedLocale, normalizeLocaleCode, appendHeaders, safeRedirectPath } from './utils'
import { rewriteLocalePath } from './path'

async function readActionPayload(request: Request): Promise<{ locale: string | null; redirectTo: string }> {
  const contentType = request.headers.get('Content-Type') ?? ''
  if (contentType.includes('application/json')) {
    const body = (await request.json()) as { locale?: unknown; redirectTo?: unknown }
    return { locale: typeof body.locale === 'string' ? body.locale : null, redirectTo: typeof body.redirectTo === 'string' ? body.redirectTo : '/' }
  }
  const formData = await request.formData()
  const locale = formData.get('locale')
  const redirectTo = formData.get('redirectTo')
  return { locale: typeof locale === 'string' ? locale : null, redirectTo: typeof redirectTo === 'string' ? redirectTo : '/' }
}

export function createLocaleAction(router: LinguiRouter) {
  return async ({ request }: { request: Request }): Promise<Response> => {
    const { locale: rawLocale, redirectTo } = await readActionPayload(request)
    const locale = matchSupportedLocale(rawLocale, router.localeCodes, router.fallbackLocale)
    const headers = new Headers()

    for (const persistence of router.config.persistence ?? []) {
      const result = await persistence.write({ request } as never, locale)
      appendHeaders(headers, result)
    }

    const safeRedirectTo = safeRedirectPath(redirectTo)
    const location =
      router.config.mode === 'url-prefix'
        ? rewriteLocalePath(safeRedirectTo, locale, router.localeCodes, {
            defaultLocale: router.defaultLocale,
            prefixDefaultLocale: router.config.prefixDefaultLocale,
            ignorePaths: router.config.ignorePaths,
          })
        : safeRedirectTo
    return redirect(location, { headers })
  }
}

export async function loadLinguiState(router: LinguiRouter, locale: string): Promise<LinguiState> {
  const matchedLocale = matchSupportedLocale(locale, router.localeCodes, router.fallbackLocale)
  const messages = await readCatalogMessages(router.config.catalogs[matchedLocale]!, matchedLocale)
  const localeMeta = router.locales.find((item) => item.code === matchedLocale)!
  return { locale: matchedLocale, localeMeta, locales: router.locales, messages, htmlAttrs: getHtmlAttrs(localeMeta) }
}

/**
 * Reads the catalog for a locale and validates its shape. Supports both the
 * Lingui `.po` import shape (`{ messages: { id: string } }`) and the compiled
 * `.js` catalog shape (`{ messages: { hash: CompiledMessage[] } }`), as well as
 * a bare messages record. Throws a locale-specific error naming the offending
 * locale when the loader rejects or the module has no usable messages.
 */
async function readCatalogMessages(loader: CatalogLoader, locale: string): Promise<Messages> {
  let mod: CatalogModule
  try {
    mod = await loader()
  } catch (cause) {
    throw new Error(`[lingui-rr] Failed to load catalog for locale "${locale}".`, { cause })
  }

  if (mod == null || typeof mod !== 'object') {
    throw new Error(`[lingui-rr] Catalog for locale "${locale}" resolved to ${describeCatalogShape(mod)}. Expected a module with a "messages" export (e.g. { messages: { ... } }) or a raw messages record.`)
  }

  let unwrapped = mod
  if (
    'default' in mod &&
    mod.default != null &&
    typeof mod.default === 'object' &&
    !Array.isArray(mod.default)
  ) {
    const outerHasValidMessages = 'messages' in mod && mod.messages != null && typeof mod.messages === 'object' && !Array.isArray(mod.messages)
    if (!outerHasValidMessages) {
      unwrapped = mod.default as CatalogModule
    }
  }

  let messages: unknown
  if ('messages' in unwrapped) {
    const val = unwrapped.messages
    if (val === null || val === undefined || (typeof val === 'object' && !Array.isArray(val))) {
      messages = val
    } else {
      messages = unwrapped
    }
  } else {
    messages = unwrapped
  }

  if (messages == null || typeof messages !== 'object' || Array.isArray(messages)) {
    throw new Error(`[lingui-rr] Catalog for locale "${locale}" did not contain usable messages. Expected a module with a "messages" export (e.g. { messages: { ... } }) or a raw messages record, got ${describeCatalogShape(mod)}.`)
  }

  return messages as Messages
}

function describeCatalogShape(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'array'
  if (typeof value !== 'object') return typeof value
  const keys = Object.keys(value)
  if (keys.length === 0) return '{} (empty object)'
  return `object with keys [${keys.slice(0, 5).join(', ')}${keys.length > 5 ? ', ...' : ''}]`
}

export function toSerializableLocaleMeta(locale: LocaleMeta): LocaleMeta {
  return { code: locale.code, label: locale.label, dir: locale.dir }
}

export function toLinguiRootLoaderData(state: LinguiState): LinguiRootLoaderData {
  return {
    locale: state.locale,
    localeMeta: toSerializableLocaleMeta(state.localeMeta),
    locales: state.locales.map(toSerializableLocaleMeta),
    messages: { ...state.messages },
    htmlAttrs: { lang: state.htmlAttrs.lang, dir: state.htmlAttrs.dir },
  }
}

export function getHtmlAttrs(locale: string | LocaleMeta, locales?: readonly LocaleMeta[]): { lang: string; dir: LocaleDirection } {
  const meta = typeof locale === 'string' ? locales?.find((item) => item.code === normalizeLocaleCode(locale)) : locale
  return { lang: typeof locale === 'string' ? normalizeLocaleCode(locale) : locale.code, dir: meta?.dir ?? 'ltr' }
}

export function getLocaleDir(locale: string | LocaleMeta, locales?: readonly LocaleMeta[]): LocaleDirection {
  return getHtmlAttrs(locale, locales).dir
}

export function getLocaleLabel(locale: string | LocaleMeta, locales?: readonly LocaleMeta[]): string {
  if (typeof locale !== 'string') return locale.label
  return locales?.find((item) => item.code === normalizeLocaleCode(locale))?.label ?? normalizeLocaleCode(locale)
}
