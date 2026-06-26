# Lesson 4: Client with Context Mode (SPA)

In this lesson, you will learn how to configure `lingui-rr` for a **Client-Only / SPA** application (`server: false`) that keeps clean URLs (`mode: 'context'`) and stores the language selection in the browser (e.g. `localStorage` or cookies).

---

## Step 1: Configure the Router `i18n` Object

Set `server: false` and `mode: 'context'`. In a pure client-only SPA, you can use `localStorage` to persist the selected language, which avoids the need to send cookies to a backend server.

```ts
// app/lib/i18n.ts
import {
  createLinguiRouter,
  clientDetectors,
  clientPersistence,
} from 'lingui-rr'

export const locales = ['en', 'ar']
export const defaultLocale = 'en'

export const i18n = createLinguiRouter({
  server: false, // SPA Mode
  mode: 'context', // Clean URLs (no prefix)
  locales,
  defaultLocale,
  detection: [
    clientDetectors.localStorage('locale'), // Detect from localStorage [!code hl]
    clientDetectors.navigator(),            // Fallback to browser language
  ],
  persistence: [clientPersistence.localStorage('locale')], // Save to localStorage [!code hl]
  ignorePaths: [
    /^\/assets\//,
    /^\/build\//,
    /^\/favicon\.ico$/,
  ],
  catalogs: {
    en: () => import('../locales/en.po'),
    ar: () => import('../locales/ar.po'),
  },
})
```

---

## Step 2: Wire the Root Route (`root.tsx`)

In your root route, export the client data functions. Similar to Lesson 3, `shouldRevalidate` is required so that the root route updates its catalog when the language is changed.

```tsx
// app/root.tsx
import {
  createLinguiClientMiddleware, // [!code focus]
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

export const clientMiddleware = [createLinguiClientMiddleware(i18n)] // [!code focus] [!code hl]
export const clientLoader = createLinguiRootLoader(i18n)             // [!code focus] [!code hl]
export const shouldRevalidate = createLinguiShouldRevalidate(i18n) // [!code focus]

export function Layout({ children }: { readonly children: React.ReactNode }) {
  const lingui = useRouteLoaderData<typeof clientLoader>('root') // [!code focus]

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
  const lingui = useLoaderData<typeof clientLoader>() // [!code focus]

  return (
    <LinguiRouterProvider state={lingui} /* [!code focus] */>
      <Outlet />
    </LinguiRouterProvider> // [!code focus]
  )
}
```

---

## Browser-Only vs. Isomorphic Storage

In Lesson 2 and 4, we introduce two kinds of client-side storage:
1. **Cookies (`clientPersistence.cookie`)**: These are isomorphic. In a React Router framework mode app, even with `server: false`, standard action forms can submit requests to server actions. Using cookies ensures that the browser-side storage is automatically mirrored via the `Set-Cookie` header during action redirects.
2. **LocalStorage (`clientPersistence.localStorage`)**: This is pure browser-only storage. If your app is served statically (e.g. from static hostings with no server-side execution at all), `localStorage` is the ideal solution. It avoids cookie headers and maintains user state locally in the user's browser.
