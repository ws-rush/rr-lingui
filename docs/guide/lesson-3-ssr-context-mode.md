# Lesson 3: SSR with Context Mode

In this lesson, you will learn how to configure `lingui-rr` for a **Server-Side Rendered (SSR)** application where the locale is stored in state (like a cookie or session) instead of being prefixed in the URL paths. Under this configuration, `/about` stays `/about` regardless of the language.

---

## Step 1: Configure the Router `i18n` Object

Set `mode: 'context'` in your router configuration. This tells the middleware to skip URL-rewriting and path-prefix validation. The active locale is resolved solely from your detectors.

```ts
// app/lib/i18n.ts
import {
  createLinguiRouter,
  serverDetectors,
  serverPersistence,
} from 'lingui-rr'

export const locales = ['en', 'ar']
export const defaultLocale = 'en'

export const i18n = createLinguiRouter({
  server: true, // SSR Mode
  mode: 'context', // Clean URLs (no prefix) [!code hl]
  locales,
  defaultLocale,
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
  ],
  catalogs: {
    en: () => import('../locales/en.po'),
    ar: () => import('../locales/ar.po'),
  },
})
```

---

## Step 2: Wire the Root Route (`root.tsx`)

Wiring up `root.tsx` is similar to URL-Prefix mode: export the middleware, loader, and shouldRevalidate.

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
import { i18n } from './lib/i18n'

export const middleware = [createLinguiMiddleware(i18n)] // [!code focus]
export const loader = createLinguiRootLoader(i18n) // [!code focus]

// CRITICAL: See Step 3 below [!code focus] [!code hl]
export const shouldRevalidate = createLinguiShouldRevalidate(i18n) // [!code focus] [!code hl]

export function Layout({ children }: { readonly children: React.ReactNode }) {
  const lingui = useRouteLoaderData<typeof loader>('root') // [!code focus]

  return (
    <html
      lang={lingui?.locale ?? 'en'} // [!code focus]
      dir={lingui?.htmlAttrs.dir ?? 'ltr'} // [!code focus]
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
    <LinguiRouterProvider state={lingui} /* [!code focus] */>
      <Outlet />
    </LinguiRouterProvider> // [!code focus]
  )
}
```

---

## Step 3: Why `shouldRevalidate` is Required in Context Mode

When a user switches their language in URL-Prefix mode (e.g. from `/about` to `/en/about`), the URL path changes. React Router detects this path change and automatically runs all loaders (including the root loader) to fetch the new page data and language catalog.

In **Context Mode**, however, switching the language (e.g. from English to Arabic) updates the cookie, but the URL remains exactly the same (`/about`). 

React Router's default behavior skips loader execution for the current page when navigating to the same URL path. Consequently:
1. The locale cookie updates.
2. The user remains on the same page.
3. **Without a custom revalidator, the root loader will not run, and the page will continue rendering in the old language until a hard refresh.**

By exporting `shouldRevalidate` wired with `createLinguiShouldRevalidate(i18n)`, `lingui-rr` forces a revalidation of the root loader whenever:
* A submission is sent to the locale-switching action route (default `/change-locale`).
* The pathname changes.

This ensures the user's view updates instantly as soon as they select a new language.
