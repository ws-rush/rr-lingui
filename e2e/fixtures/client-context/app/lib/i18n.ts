// Auto-generated fixture. Client-only (server: false), mode: context.
import { clientDetectors, clientPersistence, createLinguiRouter } from 'lingui-rr'

export const defaultLocale = 'en'

export const i18n = createLinguiRouter({
  server: false,
  mode: 'context',
  locales: {
  en: { label: 'English', dir: 'ltr' },
  ar: { label: 'العربية', dir: 'rtl' },
  },
  defaultLocale: 'en',
  detection: [clientDetectors.localStorage('locale'), clientDetectors.navigator()],
  persistence: [clientPersistence.localStorage('locale')],
    ignorePaths: [/^\/assets\//, /^\/api\//, /^\/change-locale(?:\.data)?$/],
  catalogs: {
      en: async () => ({ messages: { greeting: 'Hello from lingui-rr' } }),
      ar: async () => ({ messages: { greeting: 'مرحبا من lingui-rr' } }),
  },
})
