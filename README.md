# rr-lingui

React Router v8 framework-mode integration for Lingui.

This package is already used by `apps/web` as a URL-prefixed i18n setup with the default locale hidden:

```txt
/                    Arabic home (default locale, no prefix)
/about               Arabic about page (default locale, no prefix)
/en                  English home
/en/about            English about page
/change-locale       unprefixed locale-switch action
```

## Install

```sh
pnpm add rr-lingui @lingui/core @lingui/react
pnpm add -D @lingui/cli @lingui/conf @lingui/vite-plugin @lingui/format-po
```

> Looking for a ready-made wiring for your config? See the
> [examples](./examples/README.md) for all four variants (SSR/client ×
> url-prefix/context), including the live [`apps/web`](../apps/web)
> `server: false` + `url-prefix` integration.```

## Lingui and Vite setup

Use Lingui catalogs as normal. `apps/web` stores compiled/importable catalogs at `app/locales/{locale}.po` and enables the Lingui Vite plugin.

```ts
// lingui.config.ts
import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'

export default defineConfig({
  catalogs: [
    {
      exclude: ['**/app/locales', '**/app/*-env.d.ts'],
      include: ['app'],
      path: 'app/locales/{locale}',
    },
  ],
  fallbackLocales: { default: 'ar' },
  format: formatter({ origins: false }),
  locales: ['en', 'ar'],
  sourceLocale: 'ar',
})
```

```ts
// vite.config.ts
import { lingui } from '@lingui/vite-plugin'
import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [reactRouter(), lingui()],
})
```

## Configure the router i18n object

For the same URL-prefix pattern used in `apps/web` (the reference integration), create one shared i18n module. `apps/web` runs with `server: false`, so it uses client detectors and persistence:

```ts
// app/lib/i18n.ts
import {
  createLinguiRouter,
  clientDetectors,
  clientPersistence,
} from 'rr-lingui'

export const localeMetadata = {
  ar: { label: 'العربية', dir: 'rtl' },
  en: { label: 'English', dir: 'ltr' },
} as const

export const defaultLocale = 'ar'

export const i18n = createLinguiRouter({
  server: false,
  mode: 'url-prefix',
  locales: localeMetadata,
  defaultLocale,
  prefixDefaultLocale: false,
  detection: [
    clientDetectors.cookie('locale'),
    clientDetectors.navigator(),
  ],
  persistence: [clientPersistence.cookie('locale')],
  ignorePaths: [
    /^\/assets\//,
    /^\/build\//,
    /^\/favicon\.ico$/,
    /^\/robots\.txt$/,
    /^\/sitemap\.xml$/,
    /^\/manifest\.webmanifest$/,
    /^\/api\//,
    /^\/change-locale$/,
  ],
  catalogs: {
    ar: () => import('../locales/ar.po'),
    en: () => import('../locales/en.po'),
  },
})
```

`ignorePaths` is important for unlocalized assets, APIs, and the unprefixed locale action route.

## Root route: middleware, loader, provider, html attrs

Wire the package in `app/root.tsx`. Because `apps/web` uses `server: false`, it exports the **client** data functions (`clientMiddleware` / `clientLoader`); an SSR (`server: true`) app exports `middleware` / `loader` instead with everything else unchanged:

```tsx
// app/root.tsx
import {
  createLinguiRootLoader,
  createLinguiClientMiddleware,
  createLinguiShouldRevalidate,
  LinguiRouterProvider,
} from 'rr-lingui'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteLoaderData,
} from 'react-router'
import { defaultLocale, i18n } from './lib/i18n'

// server: false apps export `clientMiddleware` / `clientLoader`.
// An SSR (server: true) app exports `middleware` / `loader` instead and wires
// `createLinguiMiddleware` (note: server and client middleware have distinct
// result types, so there are two factories — see `server: false` mode below).
export const clientMiddleware = [createLinguiClientMiddleware(i18n)]
export const clientLoader = createLinguiRootLoader(i18n)
export const shouldRevalidate = createLinguiShouldRevalidate(i18n)

export function Layout({ children }: { readonly children: React.ReactNode }) {
  const lingui = useRouteLoaderData<typeof clientLoader>('root')
  const defaultLocaleMeta =
    i18n.locales.find((item) => item.code === defaultLocale) ?? i18n.locales[0]

  return (
    <html
      {...(lingui?.htmlAttrs ?? {
        lang: defaultLocaleMeta.code,
        dir: defaultLocaleMeta.dir,
      })}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  const lingui = useLoaderData<typeof clientLoader>()

  return (
    <LinguiRouterProvider state={lingui}>
      <Outlet />
    </LinguiRouterProvider>
  )
}
```

The middleware detects the locale, validates/rewrites URL prefixes, loads the catalog, and stores serializable Lingui state in React Router context. The root loader exposes an explicit serializable state shape (`LinguiRootLoaderData`, aliased as `LinguiState`) to React and never returns runtime-only fields such as a Lingui `i18n` instance.

No app-level cast is needed: the loader's parameter is typed with React Router's real `LoaderFunctionArgs`, so `useLoaderData<typeof clientLoader>()` (or `useLoaderData<typeof loader>()` for SSR apps) resolves to `LinguiRootLoaderData` verbatim. Without this, React Router's `SerializeFrom` step would widen Lingui's compiled `Messages` type (whose token tuples contain `unknown`) and force a `useLoaderData()` result back into shape with `as LinguiState`. The same holds for `useRouteLoaderData<typeof clientLoader>('root')`, which is simply `LinguiRootLoaderData | undefined`.

## Route files with a locale param

The package does not create React Router routes for you. Your route tree must include a locale param.

When `prefixDefaultLocale` is omitted or `true`, make the locale param required (`:lang`) because every localized page has a prefix.

When `prefixDefaultLocale: false`, make the locale param optional (`:lang?`) so hidden-default URLs like `/` and `/about` can match your app routes.

With `remix-flat-routes`, `apps/web` uses this optional-param shape:

```txt
app/routes/($lang)._layout/route.tsx          -> /:lang? layout
app/routes/($lang)._layout._index/route.tsx   -> /:lang?
app/routes/($lang)._layout.about/route.tsx    -> /:lang?/about
app/routes/($lang).$.tsx                      -> /:lang?/* 404
app/routes/change-locale.ts                   -> /change-locale action
```

Equivalent route config code is:

```ts
import { index, layout, prefix, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  ...prefix(':lang?', [
    layout('./routes/($lang)._layout/route.tsx', [
      index('./routes/($lang)._layout._index/route.tsx'),
      route('about', './routes/($lang)._layout.about/route.tsx'),
    ]),
    route('*', './routes/($lang).$.tsx'),
  ]),
  route('change-locale', './routes/change-locale.ts'),
] satisfies RouteConfig
```

Behavior in `url-prefix` mode with `defaultLocale: 'ar'` and `prefixDefaultLocale: false`:

```txt
/          -> Arabic, no redirect
/about     -> Arabic when detected/default locale is ar; otherwise redirects to /en/about
/ar/about  -> /about
/en/about  -> English
/fr/about  -> redirected to a detected/default supported locale
```

Unsupported locale-looking prefixes redirect; they do not 404 by default.

## Locale change action

Create an unprefixed action route and add it to `ignorePaths`.

```ts
// app/routes/change-locale.ts
import { createLocaleAction } from 'rr-lingui'
import { i18n } from '@/lib/i18n'

export const action = createLocaleAction(i18n)
```

Submit the current URL and target locale from your UI:

```tsx
import { Form, useLocation } from 'react-router'
import { useLinguiRouter } from 'rr-lingui'

export function LocaleButton() {
  const location = useLocation()
  const { locale, locales } = useLinguiRouter()
  const nextLocale = locales.find((item) => item.code !== locale) ?? locales[0]

  return (
    <Form method="post" action="/change-locale">
      <input
        type="hidden"
        name="redirectTo"
        value={`${location.pathname}${location.search}${location.hash}`}
      />
      <button type="submit" name="locale" value={nextLocale.code}>
        {nextLocale.label}
      </button>
    </Form>
  )
}
```

Payload contract:

```txt
locale=ar
redirectTo=/en/about
```

In `url-prefix` mode, the action persists the locale and rewrites the redirect path to the selected locale. In `context` mode, it persists the locale and redirects to the same path.

### `shouldRevalidate` and locale changes

If your root route exports a custom `shouldRevalidate`, make sure locale-change submissions revalidate the root loader. Otherwise the locale cookie can change while the current page keeps rendering the old `LinguiState` until another navigation or full reload.

The package ships a helper that implements the safe rule for both `url-prefix` and `context` mode: revalidate when the locale-switch action is submitted or the pathname changes, and skip revalidation otherwise (e.g. search-param-only navigation like `/blog?page=2`, so catalogs are not reloaded on every interaction).

```ts
import { createLinguiShouldRevalidate } from 'rr-lingui'

export const shouldRevalidate = createLinguiShouldRevalidate(i18n)
```

If your locale-switch action lives at a path other than the default `/change-locale`, pass it explicitly:

```ts
export const shouldRevalidate = createLinguiShouldRevalidate(i18n, { actionPath: '/i18n/switch' })
```

Mode-specific behavior:

- `mode: 'url-prefix'`: changing locale usually redirects to a different pathname, e.g. `/about -> /en/about` or `/en/about -> /about` when `prefixDefaultLocale: false`. A pathname-based revalidation often works, but matching the action path is still safer and handles no-op/same-path submissions.
- `mode: 'context'`: changing locale redirects back to the same path, e.g. `/terms-and-conditions -> /terms-and-conditions`. A pathname-only check will skip root revalidation, so matching the action path is required.

If you do not export a custom `shouldRevalidate`, React Router's default behavior is usually enough.

## Translating components

Use Lingui normally inside the provider:

```tsx
import { Trans } from '@lingui/react/macro'

export function AboutLinkLabel() {
  return <Trans>About us</Trans>
}
```

For locale-specific app data, read the active locale:

```tsx
import { useLinguiRouter } from 'rr-lingui'

export function LegalPage() {
  const { locale } = useLinguiRouter()
  // load/render locale-specific content for `locale`
}
```

## Links in URL-prefix mode

**Design decision:** hooks expose read-only metadata only; this package intentionally does not provide a navigation/link API. Locale-aware links are built in the app with `useLinguiRouter()` plus the pure `rewriteLocalePath()` helper. This keeps the router concerns (detection, rewriting, redirects) out of your rendering code.

There are three common patterns:

### 1. Stay in the current route tree (preferred)

For navigation within the active locale (e.g. nav menus), use React Router `<Link>` with paths relative to the current locale segment. Because the locale is already in the URL, no helper is needed:

```tsx
import { Link, useLocation } from 'react-router'
import { useLinguiRouter } from 'rr-lingui'

function Nav() {
  const { locale } = useLinguiRouter()
  // `/about` resolves against the current localized route (e.g. /en/about, /about)
  return <Link to="about">About</Link>
}
```

### 2. Link to a specific locale explicitly

When you need to point at a known path under a particular locale (cross-locale link, deep link, canonical URL), rewrite it with `rewriteLocalePath()`:

```tsx
import { Link } from 'react-router'
import { rewriteLocalePath, useLinguiRouter } from 'rr-lingui'

function LocalizedLink({ to, locale, locales, defaultLocale, prefixDefaultLocale }: {
  to: string; locale: string; locales: string[]; defaultLocale: string; prefixDefaultLocale?: boolean
}) {
  const href = rewriteLocalePath(to, locale, locales, { defaultLocale, prefixDefaultLocale })
  return <Link to={href}>{locale}</Link>
}
```

### 3. Switch the current page's locale (language switcher)

For changing the active locale, prefer the `/change-locale` action (see [Locale change action](#locale-change-action)) — it persists the choice and rewrites the redirect server-side. Use a direct `<Link>`/`rewriteLocalePath` rewrite only when you want to navigate without persisting.

### `rewriteLocalePath` reference

```ts
import { rewriteLocalePath } from 'rr-lingui'

rewriteLocalePath(path, targetLocale, supportedLocales, options?)
```

- `path` — absolute path, may include query/hash (`/en/about?x=1#t`).
- `targetLocale` — locale to write into the prefix (matched case-insensitively against `supportedLocales`).
- `supportedLocales` — your locale codes.
- `options.defaultLocale` / `options.prefixDefaultLocale` — required together to honor `prefixDefaultLocale: false`: when the target is the default locale, the prefix is omitted.
- `options.ignorePaths` — replaces the default ignored paths (assets/API). Ignored paths are returned untouched with their query/hash.

Existing locale-looking prefixes are replaced, and query strings + hashes are always preserved:

```ts
rewriteLocalePath('/en/about?x=1', 'ar', ['ar', 'en'])                       // /ar/about?x=1
rewriteLocalePath('/about', 'ar', ['ar', 'en'])                              // /ar/about
rewriteLocalePath('/about', 'en', ['ar', 'en'], { defaultLocale: 'ar', prefixDefaultLocale: false }) // /en/about
rewriteLocalePath('/about', 'ar', ['ar', 'en'], { defaultLocale: 'ar', prefixDefaultLocale: false }) // /about (default hidden)
rewriteLocalePath('/en-us/about', 'en', ['en', 'ar'])                       // /en/about (canonicalized)
```

### A note on unprefixed links with `prefixDefaultLocale: false`

An absolute unprefixed link like `/about` means *default-locale URL*. It is valid and will be served directly for the default locale, but if detection/persistence selects a non-default locale the middleware will redirect it to a prefixed URL (e.g. `/en/about`). That extra redirect uses persisted detection rather than the current URL's locale, so prefer explicit `rewriteLocalePath` (pattern 2) for cross-locale links.

## Context mode

Use context mode when URLs should not contain locales:

```ts
export const i18n = createLinguiRouter({
  server: true,
  mode: 'context',
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  detection: [serverDetectors.cookie('locale'), serverDetectors.acceptLanguage()],
  persistence: [serverPersistence.cookie('locale')],
  catalogs: {
    en: () => import('./locales/en.po'),
    ar: () => import('./locales/ar.po'),
  },
})
```

URLs are not rewritten in context mode. The locale comes from configured detectors and persistence.

## `server: false` mode

`server: false` configures the router with client detectors and persistence instead of server ones. It works with both `mode: 'url-prefix'` and `mode: 'context'`. The config must use `clientDetectors` and `clientPersistence`; server detectors/persistence are rejected.

### Middleware export: use the client factory

A `server: false` app exports `clientMiddleware` (not `middleware`), and it must use **`createLinguiClientMiddleware()`**, not `createLinguiMiddleware()`. The two route slots have different result types (`Record<string, DataStrategyResult>` for the client vs `Response` for the server), and `MiddlewareFunction` is invariant in that type, so there are two factories over one shared implementation. The runtime behavior is identical: redirects returned from client middleware are thrown by React Router's client data pipeline to perform a client-side navigation.

```ts
import { createLinguiClientMiddleware, createLinguiRootLoader, createLinguiShouldRevalidate } from 'rr-lingui'

export const clientMiddleware = [createLinguiClientMiddleware(i18n)]
export const clientLoader = createLinguiRootLoader(i18n)
export const shouldRevalidate = createLinguiShouldRevalidate(i18n)
```

An SSR (`server: true`) app instead exports `middleware = [createLinguiMiddleware(i18n)]` and `loader`. Everything else — the loader return type, `LinguiRouterProvider`, `<html lang dir>` — is identical between the two.

### `url-prefix` (the `apps/web` setup)

This is the configuration shown in [Configure the router i18n object](#configure-the-router-i18n-object) and [Root route](#root-route-middleware-loader-provider-html-attrs): `server: false` + `url-prefix` with `prefixDefaultLocale: false`. The client middleware rewrites/redirects locale prefixes both during SSR and on client-side navigation, and loads the matching catalog into context.

### `context`

`server: false` also works in `context` mode, where URLs never carry a locale and the locale lives entirely in client detectors/persistence:

```ts
import { clientDetectors, clientPersistence, createLinguiRouter } from 'rr-lingui'

export const i18n = createLinguiRouter({
  server: false,
  mode: 'context',
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  detection: [clientDetectors.cookie('locale'), clientDetectors.navigator()],
  persistence: [clientPersistence.cookie('locale')],
  catalogs: {
    en: () => import('./locales/en.po'),
    ar: () => import('./locales/ar.po'),
  },
})
```

No URL rewriting happens; the client middleware just detects the locale and loads its catalog. Because the locale is not in the URL, `shouldRevalidate` matching the `/change-locale` action is what refreshes the root loader after a language switch (see [`shouldRevalidate`](#shouldrevalidate-and-locale-changes)).

### Isomorphic client cookies & browser-only storage

The built-in client cookie detector and persistence are isomorphic for React Router framework-mode apps: they use `document.cookie` in the browser, and during server-side middleware/action execution they read the incoming `Cookie` header and return `Set-Cookie`. This keeps language changes working when a `server: false` app still submits a framework-mode action such as `/change-locale`.

For browser-only storage, use `clientDetectors.localStorage()` and `clientPersistence.localStorage()`. Those helpers only read/write when `localStorage` is available, so they are best suited to pure client-side flows.

## Hooks/helpers

```tsx
import { useLinguiRouter } from 'rr-lingui'

export function CurrentLocale() {
  const { locale, localeMeta, locales, htmlAttrs } = useLinguiRouter()
  return <span dir={htmlAttrs.dir}>{localeMeta.label}</span>
}
```

Helpers:

```ts
getHtmlAttrs('ar', locales) // { lang: 'ar', dir: 'rtl' }
getLocaleDir('ar', locales) // 'rtl'
getLocaleLabel('ar', locales) // 'العربية'
```

## Cookie options

The cookie detectors take a cookie name. The cookie persistence adapters take a
name and an optional `CookieOptions` object, so you can customize any RFC 6265
attribute. Defaults are applied and merged with your overrides (set a boolean
attribute to `false` to disable a default):

```ts
import type { CookieOptions } from 'rr-lingui'

// serverPersistence.cookie defaults: SameSite=Lax; HttpOnly
serverPersistence.cookie('locale', {
  secure: true,
  sameSite: 'Strict',
  httpOnly: false, // disable the default
  domain: '.example.com',
  maxAge: 60 * 60 * 24 * 365,
  path: '/app',
})

// clientPersistence.cookie defaults: SameSite=Lax
clientPersistence.cookie('locale', { secure: true, sameSite: 'None' })
```

Supported attributes: `path`, `maxAge`, `sameSite` (`'Lax' | 'Strict' | 'None'`),
`secure`, `httpOnly`, `domain`.

`httpOnly` is honored by browsers only when set via a server `Set-Cookie` header;
writing it through `document.cookie` in the browser is a no-op. The client cookie
persistence keeps `httpOnly` (if you set it) for the SSR action branch that
returns `Set-Cookie`.

The exported `serializeCookie(name, value, options)` helper is available for
custom persistence adapters that want to reuse the same serialization.

## Session persistence

When the locale should live in an existing session cookie (e.g. alongside auth
or user data) instead of a dedicated `locale` cookie, back persistence with a
React Router `SessionStorage` (`createCookieSessionStorage` /
`createSessionStorage`). `serverPersistence.session()` reads the locale from the
session and, on write, commits the updated session and returns its `Set-Cookie`:

```ts
import { createCookieSessionStorage } from 'react-router'
import { createLinguiRouter, serverPersistence } from 'rr-lingui'

const sessionStorage = createCookieSessionStorage({
  cookie: { name: 'session', sameSite: 'lax', secrets: ['s3cret1'] },
})

export const i18n = createLinguiRouter({
  server: true,
  mode: 'url-prefix',
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  persistence: [serverPersistence.session(sessionStorage)],
  catalogs: { /* ... */ },
})
```

Options:

```ts
serverPersistence.session(sessionStorage, {
  key: 'locale',                         // session key (default 'locale')
  commitOptions: { maxAge: 60 * 60 * 24 * 365 }, // forwarded to commitSession
})
```

The session adapter returns a single `Set-Cookie`; it merges cleanly with other
persistence adapters (the locale action appends each adapter's headers, so
multiple `Set-Cookie` values survive).

## Catalog shapes

The loader accepts any of the shapes Lingui can produce:

- `.po` import (via the Lingui Vite plugin): `{ messages: { msgid: 'translation' } }`
- compiled `.js` (`lingui compile`): `{ messages: { hash: CompiledMessage[] } }`
- a bare messages record: `{ msgid: 'translation' }`

If a catalog module is missing a usable `messages` export, the loader throws a clear error naming the locale and the shape it received. If the loader itself throws (e.g. a network/import failure), the original error is wrapped with locale context and preserved on `cause`.

## Error messages

Config and runtime errors are prefixed with `[rr-lingui]` and name the offending field, its value, and the available options — e.g. `[rr-lingui] config.defaultLocale: "xyz" is not one of locales [ar].` or `[rr-lingui] config.detection: server: false configs can only use client detectors, got a "server" detector. Use clientDetectors.* instead.` Catalog-load failures name the locale: `[rr-lingui] Failed to load catalog for locale "en".`

## Design Decisions

- Explicit `server: true | false` config.
- Explicit `mode: 'url-prefix' | 'context'`.
- Middleware is the primary integration API for both `server: true` and `server: false` configs.
- Middleware detects locale, validates URL prefix, loads and activates Lingui catalogs, and stores Lingui state in React Router context.
- Root loader helper exposes an explicit serializable Lingui state shape to React/provider for hydration and never returns runtime-only values such as a Lingui `i18n` instance.
- Provider/hooks expose read-only locale state and metadata only.
- Locale changes are handled by a unified `createLocaleAction()` helper that delegates persistence to configured persistence adapters and redirects according to mode.
- `server: false` configs must use client detectors/persistence and support both `context` and `url-prefix` modes.
- Client cookie helpers are isomorphic for React Router framework-mode execution: browser calls use `document.cookie`, while server-side middleware/action calls can read the request cookie and return `Set-Cookie`.
- Hooks do not submit, navigate, or switch locale.
- Locale metadata supports labels and direction. Simple locale arrays are accepted and normalized.
- Document/html attributes are exposed as helpers only; no automatic document mutation.
- URL-prefix mode is canonical and redirects all unprefixed app paths, excluding configured ignored paths.
- Default locale is prefixed by default via `prefixDefaultLocale: true`; hiding default locale is supported.
- Unsupported locale-looking prefixes redirect to detected/default locale.
- BCP-47-ish locale strings are supported, including canonical casing.
- Regional-to-base fallback is enabled by default.
- Config validation is fail-fast.
- Catalog loading failures always throw.
- Package targets React Router v8 framework mode first.
- Package ships ESM + `.d.ts`, with React/React Router/Lingui as peer dependencies.

### Core API sketch

```ts
const i18n = createLinguiRouter({
  server: true,
  mode: 'url-prefix',
  locales: {
    en: { label: 'English', dir: 'ltr' },
    ar: { label: 'العربية', dir: 'rtl' },
  },
  defaultLocale: 'en',
  detection: [serverDetectors.cookie('locale'), serverDetectors.acceptLanguage()],
  persistence: [serverPersistence.cookie('locale')],
  catalogs: {
    en: () => import('./locales/en/messages'),
    ar: () => import('./locales/ar/messages'),
  },
})

export const middleware = [createLinguiMiddleware(i18n)]
export const loader = createLinguiRootLoader(i18n)
export const action = createLocaleAction(i18n)
```

## Notes

- Catalog loading failures throw.
- Config validation is fail-fast.
- BCP-47-ish locale codes are supported, including regional fallback: `en-US -> en` when only `en` is configured.
- Default ignored URL-prefix paths include `/assets`, `/build`, `/favicon.ico`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, and `/api`.
