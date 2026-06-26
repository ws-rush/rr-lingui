// Auto-generated fixture. SSR (server: true), mode: url-prefix.
import { createLinguiRouter, serverDetectors, serverPersistence } from 'lingui-rr'

export const defaultLocale = 'en'

export const i18n = createLinguiRouter({
  server: true,
  mode: 'url-prefix',
  locales: {
  en: { label: 'English', dir: 'ltr' },
  ar: { label: 'العربية', dir: 'rtl' },
  },
  defaultLocale: 'en',
  prefixDefaultLocale: true,
  detection: [serverDetectors.cookie('locale'), serverDetectors.acceptLanguage()],
  persistence: [serverPersistence.cookie('locale')],
    ignorePaths: [/^\/assets\//, /^\/api\//, /^\/change-locale(?:\.data)?$/],
  catalogs: {
      en: async () => ({ messages: { greeting: 'Hello from lingui-rr' } }),
      ar: async () => ({ messages: { greeting: 'مرحبا من lingui-rr' } }),
  },
})
