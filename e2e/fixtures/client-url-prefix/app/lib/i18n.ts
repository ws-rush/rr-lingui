// Auto-generated fixture. Client-only (server: false), mode: url-prefix.
import { clientDetectors, clientPersistence, createLinguiRouter } from 'lingui-rr'

export const defaultLocale = 'en'

export const i18n = createLinguiRouter({
  server: false,
  mode: 'url-prefix',
  locales: {
  en: { label: 'English', dir: 'ltr' },
  ar: { label: 'العربية', dir: 'rtl' },
  },
  defaultLocale: 'en',
  prefixDefaultLocale: false,
  detection: [clientDetectors.cookie('locale'), clientDetectors.navigator()],
  persistence: [clientPersistence.cookie('locale')],
    ignorePaths: [/^\/assets\//, /^\/api\//, /^\/change-locale(?:\.data)?$/],
  catalogs: {
      en: async () => ({ messages: { greeting: 'Hello from lingui-rr' } }),
      ar: async () => ({ messages: { greeting: 'مرحبا من lingui-rr' } }),
  },
})
