// Auto-generated fixture.
import {
  createLinguiMiddleware,
  createLinguiRootLoader,
  createLinguiShouldRevalidate,
  LinguiRouterProvider,
  type LinguiRootLoaderData,
} from 'lingui-rr'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from 'react-router'
import { defaultLocale, i18n } from './lib/i18n'

export const middleware = [createLinguiMiddleware(i18n)]
export const loader = createLinguiRootLoader(i18n)
export const shouldRevalidate = createLinguiShouldRevalidate(i18n)

const fallbackLocaleMeta = i18n.locales.find((l) => l.code === defaultLocale)!

export function Layout({ children }: { readonly children: React.ReactNode }) {
  const lingui = useRouteLoaderData('root') as LinguiRootLoaderData | undefined
  const htmlAttrs = lingui?.htmlAttrs ?? { lang: fallbackLocaleMeta.code, dir: fallbackLocaleMeta.dir }
  return (
    <html lang={htmlAttrs.lang} dir={htmlAttrs.dir} suppressHydrationWarning>
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

export function HydrateFallback() {
  return <div>Loading…</div>
}

export function ErrorBoundary({ error }: { error: any }) {
  console.error("ErrorBoundary caught:", error)
  return (
    <div>
      <h1 data-testid="error-title">Error</h1>
      <pre data-testid="error-message">{error?.message || String(error)}</pre>
      <pre>{error?.stack}</pre>
    </div>
  )
}

export default function App() {
  const lingui = useRouteLoaderData('root') as LinguiRootLoaderData | undefined
  if (!lingui) return <div>Loading…</div>
  return (
    <LinguiRouterProvider state={lingui}>
      <Outlet />
    </LinguiRouterProvider>
  )
}
