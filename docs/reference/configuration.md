# Configuration Reference

The behavior of `lingui-rr` is governed by the `createLinguiRouter()` configuration object. Below is a detailed reference of all configuration properties.

---

## Core Options

### `server`

- **Type**: `boolean`
- **Required**: Yes
- Configures the router for either Server-Side Rendering (`true`) or Client-Only SPA (`false`). This option is validated at startup to ensure you only use appropriate detectors and persistence adapters.

### `mode`

- **Type**: `'url-prefix' | 'context'`
- **Required**: Yes
- Determines how locales are represented and resolved:
  - `'url-prefix'`: Locales are embedded as path prefixes (e.g. `/en/about`). The router handles path rewrites and prefix validation.
  - `'context'`: Locales are kept out of the URL (e.g. `/about`). The active language is tracked in state (like cookies or localStorage) via detectors.

### `locales`

- **Type**: `string[] | Record<string, { label: string; dir?: 'ltr' | 'rtl' }>`
- **Required**: Yes
- Defines the supported locales. You can pass a simple array of locale strings or a metadata record.
- Simple array elements are normalized internally: `"en"` becomes `{ code: "en", label: "en", dir: "ltr" }`.
- If a metadata record is provided, `"dir"` defaults to `"ltr"` unless specified.

### `defaultLocale`

- **Type**: `string`
- **Required**: Yes
- The fallback locale used when detection fails or when a request path has no prefix (and prefixing the default locale is disabled). Must be one of the keys defined in `locales`.

### `fallbackLocale`

- **Type**: `string`
- **Required**: No
- **Default**: Matches `defaultLocale`
- The fallback locale used when detection resolves to a language tag that is not supported. Must be one of the keys defined in `locales`.

### `prefixDefaultLocale`

- **Type**: `boolean`
- **Default**: `true`
- Only applicable when `mode` is `'url-prefix'`.
  - `true`: All localized paths require a prefix (e.g. `/ar/about`, `/en/about`).
  - `false`: The default locale is served without a prefix (e.g. `/about`), and any requests containing the default locale prefix are redirected to the clean path (e.g. `/ar/about` redirects to `/about`).

---

## Piping Options

### `detection`

- **Type**: `Detector[]`
- **Required**: No
- **Default**: `[]`
- **Isomorphic**: Yes
- An ordered pipeline of locale detectors. The router runs each detector sequentially; the first detector to return a non-null supported locale wins. If no detector succeeds, the fallback locale is resolved.
- **Server Detectors (`server: true`)**:
  - `serverDetectors.cookie(name)`: Reads from the request cookie header.
  - `serverDetectors.acceptLanguage()`: Parses the incoming `Accept-Language` headers.
  - `serverDetectors.custom({ detect: (ctx) => string | null | Promise<string | null> })`: Integrates custom detection logic (e.g., parsing subdomains or custom request headers).
- **Client Detectors (`server: false`)**:
  - `clientDetectors.cookie(name)`: Reads from `document.cookie` (isomorphic).
  - `clientDetectors.localStorage(name)`: Reads from the browser's `localStorage`.
  - `clientDetectors.navigator()`: Reads from the browser's `navigator.language`.
  - `clientDetectors.custom({ detect: (ctx) => string | null | Promise<string | null> })`: Integrates custom detection logic.

### `persistence`

- **Type**: `Persistence[]`
- **Required**: No
- **Default**: `[]`
- A pipeline of persistence adapters to save the locale when a switch occurs (e.g. via a locale change action).
- **Server Persistence (`server: true`)**:
  - `serverPersistence.cookie(name, options?)`: Writes a cookie response header.
  - `serverPersistence.session(sessionStorage, options?)`: Saves inside a React Router session storage container.
  - `serverPersistence.custom({ read?: (ctx) => string | null, write: (ctx, locale) => HeadersInit | Promise<HeadersInit> })`: Integrates custom server-side persistence logic.
- **Client Persistence (`server: false`)**:
  - `clientPersistence.cookie(name, options?)`: Writes via `document.cookie` (isomorphic).
  - `clientPersistence.localStorage(name)`: Saves to the browser's `localStorage`.
  - `clientPersistence.custom({ read?: (ctx) => string | null, write: (ctx, locale) => void | HeadersInit | Promise<void | HeadersInit> })`: Integrates custom client-side persistence logic.

### `ignorePaths`

- **Type**: `Array<RegExp | string>`
- **Required**: No
- **Default**: `[/^\/assets\//, /^\/build\//, /^\/favicon\.ico$/, /^\/robots\.txt$/, /^\/sitemap\.xml$/, /^\/manifest\.webmanifest$/, /^\/api\//]`
- A list of regular expressions or string prefixes. Matching paths bypass all i18n logic (rewriting, redirects, catalog loading).
- _Always include assets, build outputs, favicon, sitemaps, API routes, and your locale change action endpoint here._

### `catalogs`

- **Type**: `Record<string, () => Promise<any>>`
- **Required**: Yes
- An object mapping each supported locale to a dynamic import function that fetches the compiled catalog.
- **Supported catalog shapes**:
  - `.po` file imported via `@lingui/vite-plugin`: `{ messages: { messageId: 'translation' } }`
  - Compiled `.js` file via `lingui compile`: `{ messages: { hash: CompiledMessage[] } }`
  - Bare JSON messages: `{ messageId: 'translation' }`

---

## Detailed Persistence Configuration

### Cookie Options

Cookie persistence adapters accept a configuration object containing any standard RFC 6265 attributes:

```ts
serverPersistence.cookie('locale', {
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
  secure: true,
  sameSite: 'Lax',
  httpOnly: true,
  domain: '.example.com',
})
```

### Session Persistence

If you want to save the user's language selection inside an existing session cookie (e.g., alongside login details) instead of managing separate cookies:

```ts
import { createCookieSessionStorage } from 'react-router'
import { serverPersistence } from 'lingui-rr'

const sessionStorage = createCookieSessionStorage({
  cookie: { name: 'session', secrets: ['s3cret1'] },
})

// Configure persistence
serverPersistence.session(sessionStorage, {
  key: 'locale', // session key name
  commitOptions: { maxAge: 60 * 60 * 24 * 365 },
})
```
