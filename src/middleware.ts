import { redirect, type DataStrategyResult, type LoaderFunctionArgs, type MiddlewareFunction, type ShouldRevalidateFunction, type ShouldRevalidateFunctionArgs } from 'react-router'
import type { LinguiRouter, LinguiState, LinguiRootLoaderData } from './types'
import { matchSupportedLocale, appendDataSuffix } from './utils'
import { loadLinguiState, toLinguiRootLoaderData } from './state'
import { isIgnoredPath, rewriteLocalePath, looksLikeLocale } from './path'
import { linguiRouterContext } from './context'
import { runDetectors } from './detectors'

function getPathLocale(pathname: string, supportedLocales: readonly string[]): { raw: string | null; locale: string | null; supported: boolean; localeLike: boolean } {
  const raw = pathname.split('/').filter(Boolean)[0] ?? null
  if (!raw) return { raw, locale: null, supported: false, localeLike: false }
  const matched = matchSupportedLocale(raw, supportedLocales, '')
  return { raw, locale: matched || null, supported: Boolean(matched), localeLike: looksLikeLocale(raw) }
}

function redirectResponse(location: string): Response {
  return redirect(location)
}

async function resolveDetectedLocale(router: LinguiRouter, request: Request): Promise<string> {
  return runDetectors(
    router.config.detection ?? [],
    { request },
    router.localeCodes,
    router.fallbackLocale,
  )
}

type ClientMiddlewareResult = Record<string, DataStrategyResult>

function createLinguiMiddlewareImpl(router: LinguiRouter): MiddlewareFunction<Response | ClientMiddlewareResult> {
  return async (args, next) => {
    const url = new URL(args.request.url)
    const isSingleFetch = url.pathname.endsWith('.data')
    const pathname = isSingleFetch ? url.pathname.slice(0, -5) : url.pathname

    if (router.config.mode === 'url-prefix') {
      if (isIgnoredPath(pathname, router.config.ignorePaths)) return next()

      const pathLocale = getPathLocale(pathname, router.localeCodes)
      const hasCanonicalLocalePrefix = pathLocale.supported && pathLocale.raw === pathLocale.locale
      const hidesDefaultLocale = router.config.prefixDefaultLocale === false

      if (hasCanonicalLocalePrefix) {
        if (hidesDefaultLocale && pathLocale.locale === router.defaultLocale) {
          if (args.request.method === 'GET' || args.request.method === 'HEAD') {
            const location = rewriteLocalePath(`${pathname}${url.search}${url.hash}`, router.defaultLocale, router.localeCodes, {
              defaultLocale: router.defaultLocale,
              prefixDefaultLocale: router.config.prefixDefaultLocale,
              ignorePaths: router.config.ignorePaths,
            })
            const redirectLocation = isSingleFetch ? appendDataSuffix(location) : location
            return redirectResponse(redirectLocation)
          }
        }

        const state = await loadLinguiState(router, pathLocale.locale!)
        args.context.set(linguiRouterContext, state)
        return next()
      }

      const detectedLocale = await resolveDetectedLocale(router, args.request)
      const targetLocale = pathLocale.supported ? pathLocale.locale! : detectedLocale
      const location = rewriteLocalePath(`${pathname}${url.search}${url.hash}`, targetLocale, router.localeCodes, {
        defaultLocale: router.defaultLocale,
        prefixDefaultLocale: router.config.prefixDefaultLocale,
        ignorePaths: router.config.ignorePaths,
      })

      if (hidesDefaultLocale && targetLocale === router.defaultLocale && location === `${pathname}${url.search}${url.hash}`) {
        const state = await loadLinguiState(router, targetLocale)
        args.context.set(linguiRouterContext, state)
        return next()
      }

      if (args.request.method !== 'GET' && args.request.method !== 'HEAD') {
        const state = await loadLinguiState(router, targetLocale)
        args.context.set(linguiRouterContext, state)
        return next()
      }

      const redirectLocation = isSingleFetch ? appendDataSuffix(location) : location
      return redirectResponse(redirectLocation)
    }

    const locale = await resolveDetectedLocale(router, args.request)
    const state = await loadLinguiState(router, locale)
    args.context.set(linguiRouterContext, state)
    return next()
  }
}

export function createLinguiMiddleware(router: LinguiRouter): MiddlewareFunction<Response> {
  return createLinguiMiddlewareImpl(router) as MiddlewareFunction<Response>
}

export function createLinguiClientMiddleware(router: LinguiRouter): MiddlewareFunction<ClientMiddlewareResult> {
  return createLinguiMiddlewareImpl(router) as MiddlewareFunction<ClientMiddlewareResult>
}

export function createLinguiRootLoader(_router: LinguiRouter) {
  return async ({ context }: LoaderFunctionArgs): Promise<LinguiRootLoaderData> => {
    const state = context.get<LinguiState | null>(linguiRouterContext)
    if (!state) throw new Error('Lingui state was not found in React Router context. Did createLinguiMiddleware run before createLinguiRootLoader?')
    return toLinguiRootLoaderData(state)
  }
}

export const DEFAULT_LOCALE_ACTION_PATH = '/change-locale'

export function createLinguiShouldRevalidate(
  _router: LinguiRouter,
  options: { actionPath?: string } = {},
): ShouldRevalidateFunction {
  const actionPath = (options.actionPath ?? DEFAULT_LOCALE_ACTION_PATH).replace(/\/$/, '')
  return ({ currentUrl, nextUrl, formAction }: ShouldRevalidateFunctionArgs): boolean => {
    const formActionPathname = formAction ? new URL(formAction, currentUrl).pathname : null
    if (!formActionPathname) return currentUrl.pathname !== nextUrl.pathname

    let cleanPath = formActionPathname.replace(/\/$/, '')
    if (cleanPath.endsWith('.data')) {
      cleanPath = cleanPath.slice(0, -5).replace(/\/$/, '')
    }

    const segments = cleanPath.split('/').filter(Boolean)
    const first = segments[0]
    if (first && matchSupportedLocale(first, _router.localeCodes, '')) {
      segments.shift()
    }
    const normalizedFormAction = `/${segments.join('/')}`

    return normalizedFormAction === actionPath || currentUrl.pathname !== nextUrl.pathname
  }
}
