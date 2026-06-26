# Lesson 1: SSR with URL-Prefix Routing

In this lesson, you will learn how to configure `lingui-rr` for a **Server-Side Rendered (SSR)** application that represents locales in the URL path (e.g. `/about` vs `/en/about`). We will hide the prefix for the default locale (`ar`).

---

## Step 1: Configure the Router `i18n` Object

Create a file `app/lib/i18n.ts` to instantiate your Lingui router. Since this is an SSR application, we specify `server: true` and configure server-side detectors and persistence.

```ts
// app/lib/i18n.ts
import {
  createLinguiRouter,
  serverDetectors,
  serverPersistence,
} from 'lingui-rr'

export const localeMetadata = {
  ar: { label: 'العربية', dir: 'rtl' },
  en: { label: 'English', dir: 'ltr' },
} as const

export const defaultLocale = 'ar'

export const i18n = createLinguiRouter({
  server: true, // SSR mode [!code hl]
  mode: 'url-prefix', // Locale represented in path [!code hl]
  locales: localeMetadata,
  defaultLocale,
  prefixDefaultLocale: false, // Hides prefix for default locale (/about vs /en/about)
  detection: [
    serverDetectors.cookie('locale'),
    serverDetectors.acceptLanguage(),
  ],
  persistence: [serverPersistence.cookie('locale')],
  ignorePaths: [
    /^\/assets\//,
    /^\/build\//,
    /^\/favicon\.ico$/,
    /^\/robots\.txt$/,
    /^\/sitemap\.xml$/,
    /^\/manifest\.webmanifest$/,
    /^\/api\//,
    /^\/change-locale$/, // Keep our unprefixed action route clean
  ],
  catalogs: {
    ar: () => import('../locales/ar.po'),
    en: () => import('../locales/en.po'),
  },
})
```

---

## Step 2: Wire the Root Route (`root.tsx`)

In `app/root.tsx`, export the server middleware and loader. The middleware handles redirect logic and loads the compiled catalogs, while the loader passes state to the provider.

```tsx
// app/root.tsx
import {
  createLinguiMiddleware, // [!code focus]
  createLinguiRootLoader, // [!code focus]
  createLinguiShouldRevalidate, // [!code focus]
  LinguiRouterProvider, // [!code focus]
} from 'lingui-rr'
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

// Export server middleware & loader
export const middleware = [createLinguiMiddleware(i18n)] // [!code focus]
export const loader = createLinguiRootLoader(i18n) // [!code focus]
export const shouldRevalidate = createLinguiShouldRevalidate(i18n) // [!code focus]

export function Layout({ children }: { readonly children: React.ReactNode }) {
  const lingui = useRouteLoaderData<typeof loader>('root') // [!code focus]
  const defaultLocaleMeta =
    i18n.locales.find((item) => item.code === defaultLocale) ?? i18n.locales[0]

  return (
    <html
      {...(lingui?.htmlAttrs ?? { // [!code focus]
        lang: defaultLocaleMeta.code, // [!code focus]
        dir: defaultLocaleMeta.dir, // [!code focus]
      })} // [!code focus]
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
  const lingui = useLoaderData<typeof loader>() // [!code focus]

  return (
    <LinguiRouterProvider state={lingui}/* [!code focus] */>
      <Outlet />
    </LinguiRouterProvider> // [!code focus]
  )
}
```

---

## Step 3: Set up Optional Locale Param Routes

Because `prefixDefaultLocale: false` allows unprefixed routes for Arabic (e.g. `/` and `/about`), you should wrap your route tree with an optional `:lang?` parameter.

If you are using `@react-router/dev/routes` (React Router v8 config), construct it like this:

```ts
// app/routes.ts
import { index, layout, prefix, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  // Optional language parameter wrap
  ...prefix(':lang?', [
    layout('./routes/($lang)._layout/route.tsx', [
      index('./routes/($lang)._layout._index/route.tsx'),
      route('about', './routes/($lang)._layout.about/route.tsx'),
    ]),
    route('*', './routes/($lang).$.tsx'),
  ]),
  // Unprefixed route for locale changes (ignored in i18n)
  route('change-locale', './routes/change-locale.ts'),
] satisfies RouteConfig
```

---

## Step 4: Handle Language Changes

Create an action route file at `app/routes/change-locale.ts`. This endpoint accepts a `locale` and a redirect URL, persists the selection via the configured cookie, and redirects the browser.

```ts
// app/routes/change-locale.ts
import { createLocaleAction } from 'lingui-rr'
import { i18n } from '@/lib/i18n'

export const action = createLocaleAction(i18n)
```

In your frontend component, trigger this action using a form submission:

```tsx
// app/components/LocaleButton.tsx
import { Form, useLocation } from 'react-router'
import { useLinguiRouter } from 'lingui-rr'

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
        Switch to {nextLocale.label}
      </button>
    </Form>
  )
}
```

---

## Step 5: Render and Link Pages

For navigation links, you can stay within the current language branch by using relative paths:

```tsx
import { Link } from 'react-router'

// If current path is /en/dashboard, this links to /en/dashboard/settings
// If current path is /dashboard, this links to /dashboard/settings
<Link to="settings">Settings</Link>
```

When you need to construct an absolute link to a specific language, use `rewriteLocalePath()`:

```tsx
import { Link } from 'react-router'
import { rewriteLocalePath, useLinguiRouter } from 'lingui-rr'
import { defaultLocale } from '~/lib/i18n'

export function LinkToEnglish({ to }: { to: string }) {
  const { locales } = useLinguiRouter()
  
  const href = rewriteLocalePath(to, 'en', locales.map(l => l.code), {
    defaultLocale,
    prefixDefaultLocale: false
  })

  return <Link to={href}>View page in English</Link>
}
```
