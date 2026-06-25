import { describe, expect, it } from 'vitest'
import {
  validateConfig,
  createLinguiRouter,
  loadLinguiState,
  createLinguiRootLoader,
  createLinguiShouldRevalidate,
  getLocaleLabel,
  serverPersistence,
  clientPersistence,
  type LinguiRouterConfig
} from '../src/index'
import { parseCookie, parseAcceptLanguage } from '../src/utils'
import { RouterContextProvider } from 'react-router'

describe('Reviewer coverage gaps', () => {
  describe('config validation additional rules', () => {
    it('throws when config.locales is empty', () => {
      expect(() =>
        validateConfig({
          server: true,
          mode: 'context',
          locales: [],
          defaultLocale: 'en',
          catalogs: {},
        }),
      ).toThrow(/config\.locales: cannot be empty/)
    })

    it('throws when duplicate locale codes exist', () => {
      expect(() =>
        validateConfig({
          server: true,
          mode: 'context',
          locales: ['en', 'EN'],
          defaultLocale: 'en',
          catalogs: { en: async () => ({ messages: {} }), EN: async () => ({ messages: {} }) },
        }),
      ).toThrow(/duplicate locale codes/)
    })

    it('throws when server config uses client persistence', () => {
      expect(() =>
        validateConfig({
          server: true,
          mode: 'context',
          locales: ['en'],
          defaultLocale: 'en',
          persistence: [clientPersistence.localStorage()],
          catalogs: { en: async () => ({ messages: {} }) },
        } as unknown as LinguiRouterConfig),
      ).toThrow(/config\.persistence: server: true configs can only use server persistence/)
    })

    it('throws when client config uses server persistence', () => {
      expect(() =>
        validateConfig({
          server: false,
          mode: 'context',
          locales: ['en'],
          defaultLocale: 'en',
          persistence: [serverPersistence.cookie()],
          catalogs: { en: async () => ({ messages: {} }) },
        } as unknown as LinguiRouterConfig),
      ).toThrow(/config\.persistence: server: false configs can only use client persistence/)
    })
  })

  describe('catalog shapes additional rules', () => {
    it('loads a bare messages record containing a key named "messages"', async () => {
      const router = createLinguiRouter({
        server: true,
        mode: 'context',
        locales: ['en', 'ar'],
        defaultLocale: 'en',
        catalogs: {
          en: async () => ({ messages: 'Message value', hello: 'Hello' }),
          ar: async () => ({ messages: {} }),
        },
      })

      const state = await loadLinguiState(router, 'en')
      expect(state.messages).toEqual({ messages: 'Message value', hello: 'Hello' })
    })
  })

  describe('cookie parsing additional rules', () => {
    it('tolerates spaces around name and value', () => {
      expect(parseCookie('locale = en', 'locale')).toBe('en')
      expect(parseCookie('  locale  =  en  ', 'locale')).toBe('en')
    })

    it('unwraps double-quoted cookie values', () => {
      expect(parseCookie('locale="en"', 'locale')).toBe('en')
      expect(parseCookie('locale="en-US"', 'locale')).toBe('en-US')
    })
  })

  describe('Accept-Language parsing additional rules', () => {
    it('handles NaN/invalid quality parameter cleanly', () => {
      expect(parseAcceptLanguage('ar-EG;q=invalid, en;q=0.8')).toBe('en')
    })
  })

  describe('Locale metadata helper additional rules', () => {
    it('defaults to normalized code if locales list is omitted', () => {
      expect(getLocaleLabel('ar')).toBe('ar')
    })

    it('returns label when input is a LocaleMeta object', () => {
      expect(getLocaleLabel({ code: 'ar', label: 'العربية', dir: 'rtl' })).toBe('العربية')
    })
  })

  describe('createLinguiRootLoader additional rules', () => {
    it('throws clear error when context is missing', async () => {
      const router = createLinguiRouter({
        server: true,
        mode: 'context',
        locales: ['en'],
        defaultLocale: 'en',
        catalogs: { en: async () => ({ messages: {} }) },
      })
      const loader = createLinguiRootLoader(router)
      const context = new RouterContextProvider()

      await expect(
        loader({
          request: new Request('https://example.com/'),
          url: new URL('https://example.com/'),
          context,
          params: {},
          pattern: '*',
        }),
      ).rejects.toThrow(/Lingui state was not found in React Router context/)
    })
  })

  describe('createLinguiShouldRevalidate additional rules', () => {
    it('revalidates when the formAction is prefixed with a supported locale', () => {
      const router = createLinguiRouter({
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
      const shouldRevalidate = createLinguiShouldRevalidate(router)
      const baseArgs = {
        currentParams: {},
        nextParams: {},
        defaultShouldRevalidate: false,
      } as const

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
  })
})
