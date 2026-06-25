import { describe, expect, it, vi } from 'vitest'

const setupI18nCalls: any[] = []
vi.mock('@lingui/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@lingui/core')>()
  return {
    ...original,
    setupI18n: (...args: any[]) => {
      setupI18nCalls.push(args)
      return original.setupI18n(...args)
    }
  }
})

import { loadLinguiState, createLinguiRouter, matchSupportedLocale } from '../src/index'

describe('loadLinguiState performance', () => {
  it('does not call setupI18n inside loadLinguiState', async () => {
    const i18nRouter = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ hello: 'Hello' }),
      },
    })
    setupI18nCalls.length = 0
    await loadLinguiState(i18nRouter, 'en')
    expect(setupI18nCalls.length).toBe(0)
  })
})

describe('matchSupportedLocale performance and correctness', () => {
  it('correctly matches supported locales and behaves exactly the same', () => {
    expect(matchSupportedLocale('en-US', ['en', 'ar'], 'ar')).toBe('en')
    expect(matchSupportedLocale('ar-EG', ['en', 'ar'], 'en')).toBe('ar')
    expect(matchSupportedLocale('fr-FR', ['en', 'ar'], 'en')).toBe('en')
    expect(matchSupportedLocale('zh-Hant-TW', ['zh-Hant', 'en'], 'en')).toBe('zh-Hant')
    expect(matchSupportedLocale(null, ['en'], 'en')).toBe('en')
  })
})
