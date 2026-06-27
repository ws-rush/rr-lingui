# Lesson 2: Client with URL-Prefix Routing (SPA)

In this lesson, you will learn how to configure `lingui-rr` for a **Client-Only / SPA** application (`server: false`) that still represents locales in the URL paths.

---

## Step 1: Configure the Router `i18n` Object

When configuring the router for client-only execution, specify `server: false`. You must use client-specific detectors and persistence adapters.

```ts
// app/lib/i18n.ts
import {
  createLinguiRouter,
  clientDetectors,
  clientPersistence,
} from 'lingui-rr'

export const localeMetadata = {
  ar: { label: 'العربية', dir: 'rtl' },
  en: { label: 'English', dir: 'ltr' },
} as const

export const defaultLocale = 'ar'

export const i18n = createLinguiRouter({
  server: false, // SPA Mode [!code hl]
  mode: 'url-prefix',
  locales: localeMetadata,
  defaultLocale,
  prefixDefaultLocale: false,
  detection: [clientDetectors.cookie('locale'), clientDetectors.navigator()],
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

::: warning Validation Error
If you accidentally supply a server detector (like `serverDetectors.acceptLanguage()`) to a router configured with `server: false`, `lingui-rr` will throw a config validation error on start:

```txt
[lingui-rr] config.detection: server: false configs can only use client detectors, got a "server" detector.
```

:::

---

## Step 2: Wire the Root Route (`root.tsx`)

For client-only applications, React Router exposes client-side hooks for middleware and loading. In `app/root.tsx`, you must export **`clientMiddleware`** and **`clientLoader`** instead of their server-side counterparts.

Additionally, you must instantiate the client middleware using `createLinguiClientMiddleware()`.

```tsx
// app/root.tsx
import {
  createLinguiClientMiddleware, // [!code focus] [!code hl]
  createLinguiRootLoader, // [!code focus]
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

// Export client-side middleware & loader
export const clientMiddleware = [createLinguiClientMiddleware(i18n)] // [!code focus] [!code hl]
export const clientLoader = createLinguiRootLoader(i18n) // [!code focus] [!code hl]

export function Layout({ children }: { readonly children: React.ReactNode }) {
  const lingui = useRouteLoaderData<typeof clientLoader>('root') // [!code focus]
  const defaultLocaleMeta =
    i18n.locales.find((item) => item.code === defaultLocale) ?? i18n.locales[0]

  return (
    <html
      {...(lingui?.htmlAttrs ?? {
        // [!code focus]
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
  const lingui = useLoaderData<typeof clientLoader>() // [!code focus]

  return (
    <LinguiRouterProvider state={lingui} /* [!code focus] */>
      <Outlet />
    </LinguiRouterProvider> // [!code focus]
  )
}
```

---

## Why are there two separate middleware factories?

You might wonder why we call `createLinguiClientMiddleware()` for client builds and `createLinguiMiddleware()` for server builds.

React Router defines distinct result types for these two hooks:

- **Server Middleware**: Expects to return or receive a standard web `Response` object.
- **Client Middleware**: Receives and returns a record of route strategical results (`Record<string, DataStrategyResult>`).

Because these types are strictly invariant, `lingui-rr` provides separate factories. Under the hood, they share the same router logic, but `createLinguiClientMiddleware` handles redirects by throwing a React Router client navigation error, enabling smooth client-side redirects during path resolution.
