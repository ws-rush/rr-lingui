import { setupI18n } from '@lingui/core'
import { RouterContextProvider, type ClientActionFunctionArgs, type ClientLoaderFunctionArgs, type CookieSerializeOptions, type DataStrategyResult, type MiddlewareFunction, type RouterContextProvider as RRContextProvider, type SessionStorage } from 'react-router'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  clientDetectors,
  clientPersistence,
  createLinguiRouter,
  createLocaleAction,
  createLinguiClientMiddleware,
  createLinguiMiddleware,
  createLinguiRootLoader,
  createLinguiShouldRevalidate,
  linguiRouterContext,
  loadLinguiState,
  matchSupportedLocale,
  normalizeLocaleCode,
  rewriteLocalePath,
  runDetectors,
  serializeCookie,
  serverDetectors,
  serverPersistence,
  validateConfig,
  type CookieOptions,
  type LinguiRootLoaderData,
  type LinguiRouterConfig,
  type LinguiState,
} from '../src/index'
import { parseCookie, safeRedirectPath } from '../src/utils'


describe('locale normalization', () => {
  it('canonicalizes BCP-47-ish casing', () => {
    expect(normalizeLocaleCode('en-us')).toBe('en-US')
    expect(normalizeLocaleCode('ZH-hant-tw')).toBe('zh-Hant-TW')
  })

  it('falls back regional locale to base language', () => {
    expect(matchSupportedLocale('en-US', ['en', 'ar'], 'ar')).toBe('en')
    expect(matchSupportedLocale('ar-EG', ['en', 'ar'], 'en')).toBe('ar')
    expect(matchSupportedLocale('fr-FR', ['en', 'ar'], 'en')).toBe('en')
  })
})

describe('config validation', () => {
  it('throws when default locale is unsupported', () => {
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['ar'],
        defaultLocale: 'en',
        catalogs: { ar: async () => ({ messages: {} }) },
      }),
    ).toThrow(/defaultLocale/)
  })

  it('throws when catalog loader is missing', () => {
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en', 'ar'],
        defaultLocale: 'en',
        catalogs: { en: async () => ({ messages: {} }) },
      }),
    ).toThrow(/catalog/i)
  })

  it('throws when client detector is used in server config', () => {
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en'],
        defaultLocale: 'en',
        detection: [clientDetectors.localStorage('locale')],
        catalogs: { en: async () => ({ messages: {} }) },
      } as unknown as LinguiRouterConfig),
    ).toThrow(/server: true/)
  })

  it('error messages name the field, the offending value, and available options', () => {
    // defaultLocale
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['ar'],
        defaultLocale: 'xyz',
        catalogs: { ar: async () => ({ messages: {} }) },
      }),
    ).toThrow(/config\.defaultLocale.*"xyz".*\[ar\]/)

    // fallbackLocale
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en', 'ar'],
        defaultLocale: 'en',
        fallbackLocale: 'xyz',
        catalogs: { en: async () => ({ messages: {} }), ar: async () => ({ messages: {} }) },
      }),
    ).toThrow(/config\.fallbackLocale.*"xyz".*\[en, ar\]/)

    // catalog missing
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en', 'ar'],
        defaultLocale: 'en',
        catalogs: { en: async () => ({ messages: {} }) },
      }),
    ).toThrow(/config\.catalogs.*locale "ar"/)

    // detector kind mismatch names the kind and suggests the right factory
    expect(() =>
      validateConfig({
        server: false,
        mode: 'context',
        locales: ['en'],
        defaultLocale: 'en',
        detection: [serverDetectors.acceptLanguage()],
        catalogs: { en: async () => ({ messages: {} }) },
      } as unknown as LinguiRouterConfig),
    ).toThrow(/config\.detection.*server: false.*client.*clientDetectors/i)

    // prefixDefaultLocale in the wrong mode names the mode
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en'],
        defaultLocale: 'en',
        prefixDefaultLocale: false,
        catalogs: { en: async () => ({ messages: {} }) },
      }),
    ).toThrow(/config\.prefixDefaultLocale.*"context"/)
  })
})

describe('catalog shapes', () => {
  it('loads the Lingui .po import shape { messages: { id: string } }', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: { hello: 'Hello', bye: 'Goodbye' } }),
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect(state.messages).toEqual({ hello: 'Hello', bye: 'Goodbye' })
    expect(state.locale).toBe('en')
  })

  it('loads the compiled .js catalog shape { messages: { hash: CompiledMessage[] } }', async () => {
    // lingui compile emits { messages: { hash: CompiledMessageToken[] } } where
    // CompiledMessageToken is string | [name, type?, format?]. String values are
    // the common (non-ICU) case, represented as a single-token array ["..."] or
    // as a plain string per UncompiledMessage.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: { greeting: ['Hello'], withArg: ['Hello, ', ['0'], '!'] } }),
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect((state.messages as Record<string, unknown>).greeting).toEqual(['Hello'])
  })

  it('loads a bare messages record (no messages wrapper)', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ hello: 'Hello' }),
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect(state.messages).toEqual({ hello: 'Hello' })
  })

  it('loads a catalog wrapped in an ES module default export (nested messages)', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ default: { messages: { hello: 'Hello ES' } } }) as any,
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect(state.messages).toEqual({ hello: 'Hello ES' })
  })

  it('loads a catalog wrapped in an ES module default export (bare messages)', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ default: { hello: 'Hello ES Bare' } }) as any,
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect(state.messages).toEqual({ hello: 'Hello ES Bare' })
  })


  it('accepts an empty messages catalog', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect(state.messages).toEqual({})
  })
})

describe('URL prefix rewrite', () => {
  it('strictly prefixes unprefixed app paths', () => {
    expect(rewriteLocalePath('/about?x=1', 'ar', ['en', 'ar'])).toBe('/ar/about?x=1')
  })

  it('replaces existing locale prefix', () => {
    expect(rewriteLocalePath('/en/about', 'ar', ['en', 'ar'])).toBe('/ar/about')
  })

  it('redirects unsupported locale-looking prefix to target locale', () => {
    expect(rewriteLocalePath('/fr/about', 'en', ['en', 'ar'])).toBe('/en/about')
  })

  it('removes default prefix when prefixDefaultLocale is false', () => {
    expect(
      rewriteLocalePath('/ar/about', 'en', ['en', 'ar'], {
        defaultLocale: 'en',
        prefixDefaultLocale: false,
      }),
    ).toBe('/about')
  })

  it('does not rewrite ignored paths', () => {
    expect(rewriteLocalePath('/api/users', 'ar', ['en', 'ar'])).toBe('/api/users')
  })

  it('preserves query string and hash when prefixing a path', () => {
    expect(rewriteLocalePath('/about?a=1&b=2#section', 'ar', ['en', 'ar'])).toBe(
      '/ar/about?a=1&b=2#section',
    )
  })

  it('preserves query string and hash when removing the default prefix', () => {
    expect(
      rewriteLocalePath('/en/about?page=2#top', 'en', ['en', 'ar'], {
        defaultLocale: 'en',
        prefixDefaultLocale: false,
      }),
    ).toBe('/about?page=2#top')
  })

  it('preserves query string and hash when switching an existing prefix', () => {
    expect(rewriteLocalePath('/en/about?q=hi#frag', 'ar', ['en', 'ar'])).toBe(
      '/ar/about?q=hi#frag',
    )
  })

  it('canonicalizes a non-canonical locale prefix to the supported casing', () => {
    // The first segment is matched case-insensitively against supported locales;
    // when 'en' is supported, '/en-us/...' is rewritten onto the canonical 'en'.
    expect(rewriteLocalePath('/en-us/about', 'en', ['en', 'ar'])).toBe('/en/about')
  })



  it('keeps an unsupported locale-looking segment that is not locale-like', () => {
    // 'about' is not locale-like, so it is treated as a real path segment.
    expect(rewriteLocalePath('/about', 'ar', ['en', 'ar'])).toBe('/ar/about')
  })

  it('keeps an unsupported locale-like segment if it is a normal path segment (e.g. app)', () => {
    expect(rewriteLocalePath('/app/dashboard', 'ar', ['en', 'ar'])).toBe('/ar/app/dashboard')
  })

  it('respects a custom ignorePaths list that replaces the defaults', () => {
    // With a fully custom ignorePaths, the default /assets is no longer ignored...
    expect(
      rewriteLocalePath('/assets/main.css', 'ar', ['en', 'ar'], {
        ignorePaths: ['/healthcheck'],
      }),
    ).toBe('/ar/assets/main.css')
    // ...but the custom entry is.
    expect(
      rewriteLocalePath('/healthcheck', 'ar', ['en', 'ar'], {
        ignorePaths: ['/healthcheck'],
      }),
    ).toBe('/healthcheck')
  })
})

describe('detectors and persistence', () => {
  it('runs detectors by priority', async () => {
    const locale = await runDetectors(
      [
        { kind: 'server', detect: async () => null },
        { kind: 'server', detect: async () => 'ar' },
      ],
      { request: new Request('https://example.com') },
      ['en', 'ar'],
      'en',
    )

    expect(locale).toBe('ar')
  })

  it('detects Accept-Language with base fallback', async () => {
    const request = new Request('https://example.com', {
      headers: { 'Accept-Language': 'ar-EG, en;q=0.8' },
    })

    const locale = await serverDetectors.acceptLanguage().detect({ request })
    expect(locale).toBe('ar-EG')
  })
})

describe('cookie parsing', () => {
  it('parses cookies exactly matching the name', () => {
    expect(parseCookie('locale=en', 'locale')).toBe('en')
    expect(parseCookie('other_locale=ar; locale=en', 'locale')).toBe('en')
    expect(parseCookie('locale=en; other_locale=ar', 'locale')).toBe('en')
  })

  it('does not do prefix or substring matching on cookie names', () => {
    expect(parseCookie('locale_suffix=en', 'locale')).toBeNull()
    expect(parseCookie('prefix_locale=en', 'locale')).toBeNull()
  })

  it('tolerates spaces around name and value', () => {
    expect(parseCookie('locale = en', 'locale')).toBe('en')
    expect(parseCookie('  locale  =  en  ', 'locale')).toBe('en')
  })

  it('unwraps double-quoted cookie values', () => {
    expect(parseCookie('locale="en"', 'locale')).toBe('en')
    expect(parseCookie('locale="en-US"', 'locale')).toBe('en-US')
  })
})

describe('cookie serialization', () => {
  it('CookieOptions permits every documented attribute', () => {
    const opts: CookieOptions = {
      path: '/',
      maxAge: 1,
      sameSite: 'Lax',
      secure: true,
      httpOnly: true,
      domain: 'example.com',
    }
    // also accepts a strict subset / disables booleans
    const minimal: CookieOptions = { httpOnly: false }
    expect(serializeCookie('locale', 'ar', opts)).toContain('Domain=example.com')
    expect(serializeCookie('locale', 'ar', minimal)).toBe('locale=ar; Path=/')
  })

  it('uses name, encoded value, and Path=/ by default', () => {
    expect(serializeCookie('locale', 'ar')).toBe('locale=ar; Path=/')
  })

  it('URL-encodes the value', () => {
    expect(serializeCookie('locale', 'en-US')).toBe('locale=en-US; Path=/')
    // values that need encoding survive the round trip
    expect(serializeCookie('locale', 'a;b c')).toBe('locale=a%3Bb%20c; Path=/')
  })

  it('emits Max-Age when provided', () => {
    expect(serializeCookie('locale', 'ar', { maxAge: 3600 })).toBe(
      'locale=ar; Path=/; Max-Age=3600',
    )
  })

  it('emits SameSite when provided', () => {
    expect(serializeCookie('locale', 'ar', { sameSite: 'Strict' })).toBe(
      'locale=ar; Path=/; SameSite=Strict',
    )
  })

  it('emits Secure, HttpOnly, and Domain when truthy', () => {
    expect(
      serializeCookie('locale', 'ar', {
        secure: true,
        httpOnly: true,
        domain: '.example.com',
      }),
    ).toBe('locale=ar; Path=/; Secure; HttpOnly; Domain=.example.com')
  })

  it('omits Secure/HttpOnly when explicitly false', () => {
    expect(
      serializeCookie('locale', 'ar', { secure: false, httpOnly: false }),
    ).toBe('locale=ar; Path=/')
  })

  it('honors a custom path', () => {
    expect(serializeCookie('locale', 'ar', { path: '/app' })).toBe(
      'locale=ar; Path=/app',
    )
  })

  it('emits all attributes together in a stable order', () => {
    expect(
      serializeCookie('locale', 'ar', {
        path: '/app',
        maxAge: 60,
        sameSite: 'Lax',
        secure: true,
        httpOnly: true,
        domain: 'example.com',
      }),
    ).toBe(
      'locale=ar; Path=/app; Max-Age=60; SameSite=Lax; Secure; HttpOnly; Domain=example.com',
    )
  })

  it('serverPersistence.cookie applies SameSite=Lax; HttpOnly defaults', async () => {
    const persistence = serverPersistence.cookie('locale')
    const headers = await persistence.write({ request: new Request('https://example.com') }, 'ar')
    expect(headers).toEqual({ 'Set-Cookie': 'locale=ar; Path=/; SameSite=Lax; HttpOnly' })
  })

  it('serverPersistence.cookie lets options override the defaults', async () => {
    const persistence = serverPersistence.cookie('locale', {
      sameSite: 'Strict',
      httpOnly: false,
      secure: true,
      maxAge: 120,
      domain: '.example.com',
      path: '/app',
    })
    const headers = await persistence.write({ request: new Request('https://example.com') }, 'ar')
    // httpOnly: false disables the default; the rest are applied.
    expect(headers).toEqual({
      'Set-Cookie': 'locale=ar; Path=/app; Max-Age=120; SameSite=Strict; Secure; Domain=.example.com',
    })
  })

  it('clientPersistence.cookie applies SameSite=Lax default (no httpOnly) during an SSR action', async () => {
    // No document global → server-side action branch returns Set-Cookie.
    const persistence = clientPersistence.cookie('locale')
    const headers = await persistence.write({ request: new Request('https://example.com') }, 'en')
    expect(headers).toEqual({ 'Set-Cookie': 'locale=en; Path=/; SameSite=Lax' })
  })

  it('clientPersistence.cookie lets options override the default during an SSR action', async () => {
    const persistence = clientPersistence.cookie('locale', {
      sameSite: 'None',
      secure: true,
      httpOnly: true,
    })
    const headers = await persistence.write({ request: new Request('https://example.com') }, 'en')
    expect(headers).toEqual({
      'Set-Cookie': 'locale=en; Path=/; SameSite=None; Secure; HttpOnly',
    })
  })
})

describe('session persistence', () => {
  // Minimal in-memory SessionStorage stub mirroring React Router's
  // createCookieSessionStorage semantics: getSession reads from a cookie header,
  // commitSession returns a Set-Cookie value and persists to the jar.
  function createSessionStorage(jar: { cookie: string }): Pick<SessionStorage, 'getSession' | 'commitSession'> {
    let data: Record<string, unknown> = {}
    let loaded = false
    return {
      async getSession(cookieHeader?: string | null) {
        if (!loaded && cookieHeader) {
          for (const part of cookieHeader.split(';')) {
            const [k, ...rest] = part.trim().split('=')
            if (k === 'session' && rest.join('=')) data = JSON.parse(decodeURIComponent(rest.join('=')))
          }
        }
        loaded = true
        return {
          id: '',
          get data() { return data },
          get: (key: string) => data[key],
          set: (key: string, value: unknown) => { data[key] = value },
          unset: (key: string) => { delete data[key] },
          has: (key: string) => key in data,
          flash: (key: string, value: unknown) => { data[key] = value },
        } as never
      },
      async commitSession(_session: unknown, options?: CookieSerializeOptions) {
        const maxAge = options && 'maxAge' in options ? (options as { maxAge?: number }).maxAge : undefined
        const cookie = `session=${encodeURIComponent(JSON.stringify(data))}${maxAge ? `; Max-Age=${maxAge}` : ''}`
        jar.cookie = cookie
        return cookie
      },
    }
  }

  it('reads a locale previously committed to the session', async () => {
    const jar = { cookie: `session=${encodeURIComponent(JSON.stringify({ locale: 'ar' }))}` }
    const storage = createSessionStorage(jar)
    const persistence = serverPersistence.session(storage)

    const request = new Request('https://example.com', { headers: { Cookie: jar.cookie } })
    expect(await persistence.read?.({ request })).toBe('ar')
  })

  it('returns null when the session has no locale yet', async () => {
    const storage = createSessionStorage({ cookie: '' })
    const persistence = serverPersistence.session(storage)

    expect(await persistence.read?.({ request: new Request('https://example.com') })).toBeNull()
  })

  it('writes the locale and returns a Set-Cookie from commitSession', async () => {
    const jar = { cookie: '' }
    const storage = createSessionStorage(jar)
    const persistence = serverPersistence.session(storage)

    const result = await persistence.write({ request: new Request('https://example.com') }, 'en')

    expect(result).toEqual({ 'Set-Cookie': `session=${encodeURIComponent(JSON.stringify({ locale: 'en' }))}` })
    expect(jar.cookie).toContain('locale')
  })

  it('uses a custom key', async () => {
    const jar = { cookie: '' }
    const storage = createSessionStorage(jar)
    const persistence = serverPersistence.session(storage, { key: 'lang' })

    await persistence.write({ request: new Request('https://example.com') }, 'ar')

    const written = JSON.parse(decodeURIComponent(jar.cookie.replace(/^session=/, '')))
    expect(written).toEqual({ lang: 'ar' })
  })

  it('forwards commitOptions to commitSession', async () => {
    const jar = { cookie: '' }
    const storage = createSessionStorage(jar)
    const persistence = serverPersistence.session(storage, { commitOptions: { maxAge: 900 } as never })

    const result = await persistence.write({ request: new Request('https://example.com') }, 'en')

    expect(result).toEqual({
      'Set-Cookie': `session=${encodeURIComponent(JSON.stringify({ locale: 'en' }))}; Max-Age=900`,
    })
  })

  it('round-trips a write then read', async () => {
    const jar = { cookie: '' }
    const storage = createSessionStorage(jar)
    const persistence = serverPersistence.session(storage)

    await persistence.write({ request: new Request('https://example.com') }, 'ar')
    const read = await persistence.read?.({ request: new Request('https://example.com', { headers: { Cookie: jar.cookie } }) })
    expect(read).toBe('ar')
  })
})

describe('middleware and loader', () => {
  it('url-prefix middleware redirects unprefixed paths before next', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      detection: [serverDetectors.acceptLanguage()],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/about', { headers: { 'Accept-Language': 'ar-EG' } }),
        url: new URL('https://example.com/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(false)
    expect(response).toBeInstanceOf(Response)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/ar/about')
  })

  it('url-prefix middleware serves hidden default locale without self-redirecting', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      detection: [serverDetectors.acceptLanguage()],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/', { headers: { 'Accept-Language': 'ar' } }),
        url: new URL('https://example.com/'),
        context,
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(true)
    expect((response as Response).status).toBe(200)
    expect(context.get(linguiRouterContext)?.locale).toBe('ar')
  })

  it('url-prefix middleware removes default prefix when default locale is hidden', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/ar/about'),
        url: new URL('https://example.com/ar/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/about')
  })

  it('middleware stores loaded Lingui state and loader returns it', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: { en: { label: 'English', dir: 'ltr' }, ar: { label: 'العربية', dir: 'rtl' } },
      defaultLocale: 'en',
      detection: [serverDetectors.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: { hello: 'Hello' } }),
        ar: async () => ({ messages: { hello: 'مرحبا' } }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(i18n)
    const loader = createLinguiRootLoader(i18n)

    await middleware(
      {
        request: new Request('https://example.com/current', { headers: { Cookie: 'locale=ar' } }),
        url: new URL('https://example.com/current'),
        context,
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect(context.get(linguiRouterContext)?.locale).toBe('ar')
    await expect(
      loader({ request: new Request('https://example.com/current'), url: new URL('https://example.com/current'), context, params: {}, pattern: '*' }),
    ).resolves.toMatchObject({ locale: 'ar', localeMeta: { label: 'العربية', dir: 'rtl' }, htmlAttrs: { lang: 'ar', dir: 'rtl' } })
  })

  it('root loader returns only the explicit serializable state boundary', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: { en: { label: 'English', dir: 'ltr' }, ar: { label: 'العربية', dir: 'rtl' } },
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const loader = createLinguiRootLoader(i18n)
    const serializableState: LinguiState = {
      locale: 'en',
      localeMeta: { code: 'en', label: 'English', dir: 'ltr' },
      locales: [
        { code: 'en', label: 'English', dir: 'ltr' },
        { code: 'ar', label: 'العربية', dir: 'rtl' },
      ],
      messages: { hello: 'Hello' },
      htmlAttrs: { lang: 'en', dir: 'ltr' },
    }
    const stateWithRuntimeOnlyFields = {
      ...serializableState,
      i18n: setupI18n(),
      runtimeOnly: () => 'not serializable',
    }

    context.set(linguiRouterContext, stateWithRuntimeOnlyFields)

    const loaded = await loader({
      request: new Request('https://example.com/current'),
      url: new URL('https://example.com/current'),
      context,
      params: {},
      pattern: '*',
    })

    expect(loaded).toStrictEqual(serializableState)
    expect(Object.hasOwn(loaded, 'i18n')).toBe(false)
    expect(Object.hasOwn(loaded, 'runtimeOnly')).toBe(false)
    expect(JSON.parse(JSON.stringify(loaded))).toStrictEqual(loaded)
  })

  it('server:false middleware can detect a client cookie during an SSR request', async () => {
    const i18n = createLinguiRouter({
      server: false,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      detection: [clientDetectors.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(i18n)

    await middleware(
      {
        request: new Request('https://example.com/current', { headers: { Cookie: 'locale=ar' } }),
        url: new URL('https://example.com/current'),
        context,
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect(context.get(linguiRouterContext)?.locale).toBe('ar')
  })

  it('server:false url-prefix middleware redirects using client cookie detection during an SSR request', async () => {
    const i18n = createLinguiRouter({
      server: false,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      detection: [clientDetectors.cookie('locale')],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/about', { headers: { Cookie: 'locale=en' } }),
        url: new URL('https://example.com/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(false)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('server:false url-prefix middleware loads state for a canonical prefixed request', async () => {
    const i18n = createLinguiRouter({
      server: false,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      detection: [clientDetectors.cookie('locale')],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/en/about', { headers: { Cookie: 'locale=ar' } }),
        url: new URL('https://example.com/en/about'),
        context,
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(200)
    expect(context.get(linguiRouterContext)?.locale).toBe('en')
  })

  it('url-prefix middleware redirects non-canonical casing to the canonical prefix', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/EN/about'),
        url: new URL('https://example.com/EN/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('url-prefix middleware canonicalizes a supported-base regional prefix (/en-us)', async () => {
    // 'en' is supported; 'en-us' matches by base fallback but is not the
    // canonical prefix, so the middleware redirects to the canonical locale.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/en-us/about'),
        url: new URL('https://example.com/en-us/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('url-prefix middleware canonicalizes a supported-base regional prefix with casing (/en-GB)', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/en-GB/about'),
        url: new URL('https://example.com/en-GB/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('url-prefix middleware redirects an unsupported regional prefix to the detected locale prefix', async () => {
    // 'de-DE' is locale-like but neither the region nor its base is supported.
    // The middleware redirects to a supported locale prefix (detected/default)
    // while preserving the rest of the path.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/de-DE/about'),
        url: new URL('https://example.com/de-DE/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(false)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('url-prefix middleware redirects an unsupported regional prefix to a non-default detected locale', async () => {
    // Same as above, but detection picks a non-default locale; the redirected
    // prefix reflects the detected locale, not the unsupported one.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      detection: [serverDetectors.acceptLanguage()],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/de-DE/about', {
          headers: { 'Accept-Language': 'ar-EG' },
        }),
        url: new URL('https://example.com/de-DE/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/ar/about')
  })

  it('url-prefix middleware redirects an unsupported base-language prefix to the detected locale', async () => {
    // 'fr' is locale-like but unsupported; redirects to detected/default prefix.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/fr/about'),
        url: new URL('https://example.com/fr/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('url-prefix middleware redirects non-default detection and preserves query/hash', async () => {
    // prefixDefaultLocale: false, default locale ar. An unprefixed path with a
    // cookie selecting the *non-default* locale 'en' must redirect to the
    // prefixed URL while keeping the query string and hash.
    const i18n = createLinguiRouter({
      server: false,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      detection: [clientDetectors.cookie('locale')],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/about?page=3#section', {
          headers: { Cookie: 'locale=en' },
        }),
        url: new URL('https://example.com/about?page=3#section'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(false)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about?page=3#section')
  })

  it('url-prefix middleware serves the hidden default locale and preserves query/hash', async () => {
    // Same hidden-default setup, but detection selects the default locale 'ar',
    // so the unprefixed URL is served directly (no self-redirect) with query/hash intact.
    const i18n = createLinguiRouter({
      server: false,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      detection: [clientDetectors.cookie('locale')],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/blog?tag=news#top', {
          headers: { Cookie: 'locale=ar' },
        }),
        url: new URL('https://example.com/blog?tag=news#top'),
        context,
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(true)
    expect((response as Response).status).toBe(200)
    expect(context.get(linguiRouterContext)?.locale).toBe('ar')
  })

  it('url-prefix middleware respects a custom ignorePaths list', async () => {
    // The default ignored paths are replaced by config.ignorePaths, so a path
    // that the defaults would ignore is now processed by the middleware.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      ignorePaths: ['/healthcheck'],
      detection: [serverDetectors.acceptLanguage()],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const apiResponse = await middleware(
      {
        request: new Request('https://example.com/assets/users'),
        url: new URL('https://example.com/assets/users'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    // /assets is no longer in the custom ignorePaths, so the middleware redirects.
    expect(calledNext).toBe(false)
    expect((apiResponse as Response).status).toBe(302)
    expect((apiResponse as Response).headers.get('Location')).toBe('/en/assets/users')

    calledNext = false
    const healthResponse = await middleware(
      {
        request: new Request('https://example.com/healthcheck'),
        url: new URL('https://example.com/healthcheck'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    // The custom ignorePaths entry is honored: middleware calls next directly.
    expect(calledNext).toBe(true)
    expect((healthResponse as Response).status).toBe(200)
  })

  it('throws when a catalog loader rejects while loading state directly', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => { throw new Error('catalog network down') },
        ar: async () => ({ messages: {} }),
      },
    })

    // The loader error is wrapped with locale context; the original error is
    // preserved on `cause`.
    await expect(loadLinguiState(i18n, 'en')).rejects.toThrow(/Failed to load catalog for locale "en"/)
    await expect(loadLinguiState(i18n, 'en')).rejects.toMatchObject({ cause: { message: 'catalog network down' } })
  })

  it('throws a clear error when a catalog module has a null messages export', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: null } as never), // wrong shape
        ar: async () => ({ messages: {} }),
      },
    })

    await expect(loadLinguiState(i18n, 'en')).rejects.toThrow(/Catalog for locale "en" did not contain usable messages/)
  })

  it('throws a clear error when a catalog module resolves to null', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => null as never,
        ar: async () => ({ messages: {} }),
      },
    })

    await expect(loadLinguiState(i18n, 'en')).rejects.toThrow(/Catalog for locale "en" resolved to null/)
  })

  it('propagates a catalog loader failure through the middleware', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => { throw new Error('boom') },
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    await expect(
      middleware(
        {
          request: new Request('https://example.com/en/about'),
          url: new URL('https://example.com/en/about'),
          context: new RouterContextProvider(),
          params: {},
          pattern: '*',
        },
        async () => new Response('ok'),
      ),
    ).rejects.toThrow(/Failed to load catalog for locale "en"/)
  })
})

describe('createLocaleAction', () => {
  it('persists server cookie and redirects with rewritten URL prefix', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/en/about' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/ar/about')
    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
  })

  it('server action persists cookie and redirects unchanged in context mode', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/terms-and-conditions' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/terms-and-conditions')
    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
  })

  it('client action uses client persistence and redirects unchanged in context mode', async () => {
    const writes: string[] = []
    const i18n = createLinguiRouter({
      server: false,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [clientPersistence.custom({ write: async (_ctx, locale) => { writes.push(locale) } })],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(writes).toEqual(['ar'])
    expect(response.headers.get('Location')).toBe('/current')
  })

  it('server:false client cookie persistence returns Set-Cookie during an SSR action', async () => {
    const i18n = createLinguiRouter({
      server: false,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [clientPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/current')
    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
  })

  it('server:false url-prefix action persists client cookie and rewrites redirect path during SSR', async () => {
    const i18n = createLinguiRouter({
      server: false,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      persistence: [clientPersistence.cookie('locale')],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'en', redirectTo: '/about' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/en/about')
    expect(response.headers.get('Set-Cookie')).toContain('locale=en')
  })

  it('accepts an application/json payload', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'ar', redirectTo: '/en/about' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/ar/about')
    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
  })

  it('defaults the redirect target to "/" when the json payload omits redirectTo', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'ar' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/')
  })

  it('falls back to the fallback locale for an unsupported locale in the payload', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      fallbackLocale: 'ar',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'fr', redirectTo: '/current' }),
    })

    const response = await action({ request })

    // 'fr' is unsupported → matchSupportedLocale falls back to fallbackLocale 'ar'.
    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
    expect(response.headers.get('Location')).toBe('/current')
  })

  it('ignores a missing locale and persists the fallback locale', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      fallbackLocale: 'ar',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
    expect(response.headers.get('Location')).toBe('/current')
  })

  it.each([
    ['protocol-relative', '//evil.com'],
    ['absolute https', 'https://evil.com/path'],
    ['absolute http', 'http://evil.com'],
    ['backslash protocol-relative', '\\\\evil.com'],
    ['scheme separator', '/\\evil.com'],
  ])('neutralizes an open-redirect payload (%s)', async (_name, payload) => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: payload }),
    })

    const response = await action({ request })

    expect(response.headers.get('Location')).toBe('/')
  })

  it('allows a relative redirect with query/hash and rewrites the prefix in url-prefix mode', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/about?x=1#t' }),
    })

    const response = await action({ request })

    expect(response.headers.get('Location')).toBe('/ar/about?x=1#t')
  })

  it('merges Set-Cookie headers from multiple persistence adapters', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [
        serverPersistence.cookie('locale', { httpOnly: true }),
        serverPersistence.cookie('prefs', { httpOnly: false }),
      ],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    // Both cookies survive the merge as separate Set-Cookie values
    // (Headers.append preserves them; .get() comma-joins them).
    expect(response.headers.get('Location')).toBe('/current')
    expect(response.headers.getSetCookie()).toEqual([
      'locale=ar; Path=/; SameSite=Lax; HttpOnly',
      'prefs=ar; Path=/; SameSite=Lax',
    ])
  })

  it('merges Set-Cookie headers when one adapter is session-backed', async () => {
    const sessionJar = { cookie: '' }
    const sessionStorage: Pick<SessionStorage, 'getSession' | 'commitSession'> = {
      getSession: async () => ({ get: () => undefined, set: () => {}, has: () => false, unset: () => {}, flash: () => {}, id: '', data: {} }) as never,
      commitSession: async () => {
        const v = 'session=%7B%22locale%22%3A%22ar%22%7D'
        sessionJar.cookie = v
        return v
      },
    }
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [
        serverPersistence.cookie('locale', { httpOnly: true }),
        serverPersistence.session(sessionStorage),
      ],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.headers.getSetCookie()).toEqual([
      'locale=ar; Path=/; SameSite=Lax; HttpOnly',
      'session=%7B%22locale%22%3A%22ar%22%7D',
    ])
  })

  it('preserves multiple Set-Cookie values from a single adapter returning [name, value][]', async () => {
    // A custom adapter can return multiple Set-Cookie values by using the
    // array-of-tuples HeadersInit shape, which appendHeaders preserves.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [
        serverPersistence.custom({
          read: async () => null,
          write: async () => [['Set-Cookie', 'a=1; Path=/'], ['Set-Cookie', 'b=2; Path=/']],
        }),
      ],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/'])
  })

  it('merges headers across adapters with different header names', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [
        serverPersistence.cookie('locale'),
        serverPersistence.custom({
          read: async () => null,
          write: async () => ({ 'X-Locale': 'ar', 'Vary': 'Cookie' }),
        }),
      ],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.headers.get('X-Locale')).toBe('ar')
    expect(response.headers.get('Vary')).toBe('Cookie')
    expect(response.headers.get('Location')).toBe('/current')
  })

  it('still works when persistence is empty', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/current')
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('prevents open redirects in createLocaleAction', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)

    const payloads = [
      { redirectTo: '//evil.com', expected: '/' },
      { redirectTo: '/\\evil.com', expected: '/' },
      { redirectTo: '/\t/evil.com', expected: '/' },
      { redirectTo: '/\n/evil.com', expected: '/' },
      { redirectTo: '/\r/evil.com', expected: '/' },
      { redirectTo: '/\\/evil.com', expected: '/' },
      { redirectTo: '///evil.com', expected: '/' },
    ]

    for (const { redirectTo, expected } of payloads) {
      const request = new Request('https://example.com/change-locale', {
        method: 'POST',
        body: new URLSearchParams({ locale: 'ar', redirectTo }),
      })
      const response = await action({ request })
      expect(response.headers.get('Location')).toBe(expected)
    }
  })
})

// Faithful essence of React Router's `SerializeFrom` (from
// `react-router/dist/.../lib/types/route-data.d.ts`). Reproduced here because
// `SerializeFrom` is not part of the public `react-router` surface. It is the
// exact machinery that decides whether `useLoaderData<typeof loader>()` runs
// the recursive `Serialize` step (which widens Lingui `Messages`) or preserves
// the loader's declared return type verbatim.
type RRSerializable =
  | undefined | null | boolean | string | symbol | number | bigint | Date | URL | RegExp | Error
  | Array<RRSerializable>
  | { [key: PropertyKey]: RRSerializable }
  | Map<RRSerializable, RRSerializable>
  | Set<RRSerializable>
  | Promise<RRSerializable>

type RRSerialize<T> = T extends RRSerializable
  ? T
  : T extends (...args: any[]) => unknown
    ? undefined
    : T extends Promise<infer U>
      ? Promise<RRSerialize<U>>
      : T extends Array<infer U>
        ? Array<RRSerialize<U>>
        : T extends Record<any, any>
          ? { [K in keyof T]: RRSerialize<T[K]> }
          : undefined

// `ClientDataFunctionArgs` is internal to react-router, so reconstruct its
// public shape (matches `ClientLoaderFunctionArgs` minus `serverLoader`).
type ClientDataFunctionArgs<Params> = {
  request: Request
  url: URL
  params: Params
  pattern: string
  context: Readonly<RRContextProvider>
}

type RRSerializeFrom<F> = F extends (...args: infer A) => unknown
  ? A extends [ClientLoaderFunctionArgs | ClientActionFunctionArgs | ClientDataFunctionArgs<unknown>]
    ? Awaited<ReturnType<F>>
    : RRSerialize<Awaited<ReturnType<F>>>
  : never

describe('loader type inference', () => {
  const i18n = createLinguiRouter({
    server: false,
    mode: 'url-prefix',
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
    catalogs: {
      ar: async () => ({ messages: {} }),
      en: async () => ({ messages: {} }),
    },
  })

  it('exposes the loader return type that needs no app-level cast', () => {
    const loader = createLinguiRootLoader(i18n)

    // Regression guard for ROADMAP #1: React Router's SerializeFrom must skip its
    // message-widening serialization step so `useLoaderData<typeof loader>()`
    // resolves to `LinguiRootLoaderData` (a.k.a. `LinguiState`) verbatim. If the
    // loader's parameter type ever loosens so this discriminator falls through to
    // `RRSerialize`, `messages` widens to `{ [x]: string | (string | undefined[])[] }`
    // and apps are forced back to `as LinguiState` casts.
    expectTypeOf<RRSerializeFrom<typeof loader>>().toEqualTypeOf<LinguiRootLoaderData>()
    expectTypeOf<RRSerializeFrom<typeof loader>>().toEqualTypeOf<LinguiState>()
  })
})

describe('middleware export types', () => {
  type ClientResult = Record<string, DataStrategyResult>
  const i18n = createLinguiRouter({
    server: true,
    mode: 'url-prefix',
    locales: ['en', 'ar'],
    defaultLocale: 'en',
    catalogs: {
      en: async () => ({ messages: {} }),
      ar: async () => ({ messages: {} }),
    },
  })

  it('createLinguiMiddleware matches the server `middleware` slot (Response result)', () => {
    const middleware = createLinguiMiddleware(i18n)
    // Server route slot: MiddlewareFunction<Response>
    expectTypeOf<typeof middleware>().toMatchTypeOf<MiddlewareFunction<Response>>()
  })

  it('createLinguiClientMiddleware matches the `clientMiddleware` slot (DataStrategyResult map)', () => {
    const clientMiddleware = createLinguiClientMiddleware(i18n)
    // Client route slot: MiddlewareFunction<Record<string, DataStrategyResult>>
    expectTypeOf<typeof clientMiddleware>().toMatchTypeOf<MiddlewareFunction<ClientResult>>()
  })

  it('the server and client result types are distinct (invariant), so the two exports are needed', () => {
    // MiddlewareFunction is invariant in its result type (it flows through `next`).
    // A server-typed middleware must NOT be assignable to the client slot, which is
    // why the package ships a separate `createLinguiClientMiddleware`.
    const serverMiddleware = createLinguiMiddleware(i18n)
    expectTypeOf<typeof serverMiddleware>().not.toMatchTypeOf<MiddlewareFunction<ClientResult>>()
  })

  it('createLinguiClientMiddleware is not assignable to the server slot either', () => {
    const clientMiddleware = createLinguiClientMiddleware(i18n)
    expectTypeOf<typeof clientMiddleware>().not.toMatchTypeOf<MiddlewareFunction<Response>>()
  })
})

describe('createLinguiShouldRevalidate', () => {
  const i18n = createLinguiRouter({
    server: false,
    mode: 'url-prefix',
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
    prefixDefaultLocale: false,
    catalogs: {
      ar: async () => ({ messages: {} }),
      en: async () => ({ messages: {} }),
    },
  })

  const shouldRevalidate = createLinguiShouldRevalidate(i18n)
  const baseArgs = {
    currentParams: {},
    nextParams: {},
    defaultShouldRevalidate: false,
  } as const

  it('revalidates when a locale-change action is submitted', () => {
    const currentUrl = new URL('https://example.com/ar/about')
    expect(
      shouldRevalidate({
        ...baseArgs,
        currentUrl,
        nextUrl: new URL('https://example.com/en/about'),
        formAction: '/change-locale',
        formMethod: 'POST',
      }),
    ).toBe(true)
  })

  it('revalidates when the pathname changes during navigation', () => {
    expect(
      shouldRevalidate({
        ...baseArgs,
        currentUrl: new URL('https://example.com/ar/about'),
        nextUrl: new URL('https://example.com/ar/contact'),
      }),
    ).toBe(true)
  })

  it('matches the action path even when the submission posts to the full URL', () => {
    const currentUrl = new URL('https://example.com/ar/about')
    expect(
      shouldRevalidate({
        ...baseArgs,
        currentUrl,
        nextUrl: currentUrl, // context mode: redirect lands on the same path
        formAction: 'https://example.com/change-locale',
        formMethod: 'POST',
      }),
    ).toBe(true)
  })

  it('does not revalidate for a search-param-only navigation', () => {
    expect(
      shouldRevalidate({
        ...baseArgs,
        currentUrl: new URL('https://example.com/ar/blog?page=1'),
        nextUrl: new URL('https://example.com/ar/blog?page=2'),
      }),
    ).toBe(false)
  })

  it('does not revalidate for an unrelated form action on the same path', () => {
    expect(
      shouldRevalidate({
        ...baseArgs,
        currentUrl: new URL('https://example.com/ar/contact'),
        nextUrl: new URL('https://example.com/ar/contact'),
        formAction: '/contact',
        formMethod: 'POST',
      }),
    ).toBe(false)
  })

  it('revalidates when the formAction is prefixed with a supported locale', () => {
    const currentUrl = new URL('https://example.com/ar/about')
    expect(
      shouldRevalidate({
        ...baseArgs,
        currentUrl,
        nextUrl: currentUrl,
        formAction: '/ar/change-locale',
        formMethod: 'POST',
      }),
    ).toBe(true)
  })

  it('honors a custom action path', () => {
    const shouldRevalidateCustom = createLinguiShouldRevalidate(i18n, {
      actionPath: '/i18n/switch',
    })
    const currentUrl = new URL('https://example.com/ar/about')
    expect(
      shouldRevalidateCustom({
        ...baseArgs,
        currentUrl,
        nextUrl: currentUrl,
        formAction: '/i18n/switch',
        formMethod: 'POST',
      }),
    ).toBe(true)
    expect(
      shouldRevalidateCustom({
        ...baseArgs,
        currentUrl,
        nextUrl: currentUrl,
        formAction: '/change-locale',
        formMethod: 'POST',
      }),
    ).toBe(false)
  })
})

describe('safeRedirectPath', () => {
  it('blocks dangerous redirect paths and allows safe ones', () => {
    expect(safeRedirectPath('/home')).toBe('/home')
    expect(safeRedirectPath('/about/us?ref=xyz')).toBe('/about/us?ref=xyz')
    expect(safeRedirectPath('//evil.com')).toBe('/')
    expect(safeRedirectPath('/\\evil.com')).toBe('/')
    expect(safeRedirectPath('/\\/evil.com')).toBe('/')
    expect(safeRedirectPath('///evil.com')).toBe('/')
    expect(safeRedirectPath('https://evil.com')).toBe('/')
    expect(safeRedirectPath('//')).toBe('/')
    expect(safeRedirectPath('/%2f/evil.com')).toBe('/%2f/evil.com')
  })

  it('blocks control character bypasses (tab, newline, CR)', () => {
    expect(safeRedirectPath('/\t/evil.com')).toBe('/')
    expect(safeRedirectPath('/\n/evil.com')).toBe('/')
    expect(safeRedirectPath('/\r/evil.com')).toBe('/')
    expect(safeRedirectPath('/\n\r\t/evil.com')).toBe('/')
    expect(safeRedirectPath('/\\\t/evil.com')).toBe('/')
  })
})


