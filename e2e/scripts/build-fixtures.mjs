// Generates four minimal React Router framework-mode apps under fixtures/<config>/,
// one per rr-lingui configuration. Each fixture is a standalone app so it builds
// in exactly one mode (SSR apps export `middleware`/`loader`; SPA apps export
// `clientMiddleware`/`clientLoader` — React Router statically forbids the server
// exports in SPA mode, so a single shared root cannot satisfy both).
//
// Run before tests: `node scripts/build-fixtures.mjs`. The output (`fixtures/`)
// is generated; do not edit it by hand.
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const fixturesDir = join(root, 'fixtures')

// ---- shared, identical across all fixtures ---------------------------------

const viteConfig = `import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'

// Minimal Vite setup. Catalogs are plain objects in app/lib/i18n.ts (predictable
// ids, no Lingui macro/hashing), so no Lingui Vite plugin is needed.
export default defineConfig({
  plugins: [reactRouter()],
  cacheDir: './.vite',
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
      'react-router',
      '@lingui/core',
      '@lingui/react',
      'rr-lingui',
    ],
  },
})
`

const tsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["vite/client", "node"],
    "rootDirs": [".", "./.react-router/types"]
  },
  "include": ["app", ".react-router/types/**/*"]
}
`

const viteEnv = `/// <reference types="vite/client" />\n`

const homeTsx = `import { useLingui } from '@lingui/react'
import { Form, useLocation } from 'react-router'
import { useLinguiRouter } from 'rr-lingui'

export default function Home() {
  const { _ } = useLingui()
  const { locale, localeMeta } = useLinguiRouter()
  const location = useLocation()
  return (
    <main>
      <h1 data-testid="greeting">{_('greeting')}</h1>
      <p data-testid="locale">{locale}</p>
      <p data-testid="dir">{localeMeta.dir}</p>
      <Form method="post" action="/change-locale" data-testid="switch-form">
        <input name="redirectTo" type="hidden" value={location.pathname} />
        <button data-testid="switch-en" name="locale" type="submit" value="en">English</button>
        <button data-testid="switch-ar" name="locale" type="submit" value="ar">العربية</button>
      </Form>
    </main>
  )
}
`

const layoutTsx = `import { Outlet } from 'react-router'

// Locale-segment layout for url-prefix configs.
export default function LocaleLayout() {
  return <Outlet />
}
`

const entryClientTsx = `import { HydratedRouter } from 'react-router/dom'
import { startTransition, StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  )
})
`

const entryServerTsx = `import { PassThrough } from 'node:stream'
import { createReadableStreamFromReadable } from '@react-router/node'
import { ServerRouter } from 'react-router'
import { renderToPipeableStream } from 'react-dom/server'

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: any
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady() {
          shellRendered = true
          const body = new PassThrough()
          const stream = createReadableStreamFromReadable(body)
          responseHeaders.set('Content-Type', 'text/html')
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          )
          pipe(body)
        },
        onShellError(error: unknown) {
          reject(error)
        },
        onError(error: unknown) {
          responseStatusCode = 500
          if (shellRendered) {
            console.error(error)
          }
        },
      }
    )
    setTimeout(abort, 10000)
  })
}
`

function changeLocaleTs(f) {
  return `import { createLocaleAction } from 'rr-lingui'
import { i18n } from '../lib/i18n'

export const ${f.client ? 'clientAction' : 'action'} = createLocaleAction(i18n)
`
}

// ---- per-configuration generation -----------------------------------------

const locales = `  en: { label: 'English', dir: 'ltr' },
  ar: { label: 'العربية', dir: 'rtl' },`

const catalogs = `      en: async () => ({ messages: { greeting: 'Hello from rr-lingui' } }),
      ar: async () => ({ messages: { greeting: 'مرحبا من rr-lingui' } }),`

const ignorePaths = `    ignorePaths: [/^\\/assets\\//, /^\\/api\\//, /^\\/change-locale(?:\\.data)?$/],`

/**
 * @typedef {{ ssr: boolean, context: boolean, prefix: boolean, client: boolean }} Flags
 */

/** @param {Flags} f */
function i18nTsx(f) {
  const serverBlock = `  server: true,
  mode: ${f.context ? "'context'" : "'url-prefix'"},
  locales: {
${locales}
  },
  defaultLocale: 'en',
${f.context ? '' : "  prefixDefaultLocale: true,\n"}  detection: [serverDetectors.cookie('locale'), serverDetectors.acceptLanguage()],
  persistence: [serverPersistence.cookie('locale')],`

  const clientBlock = `  server: false,
  mode: ${f.context ? "'context'" : "'url-prefix'"},
  locales: {
${locales}
  },
  defaultLocale: 'en',
${f.context ? '' : "  prefixDefaultLocale: false,\n"}  detection: ${
    f.context
      ? "[clientDetectors.localStorage('locale'), clientDetectors.navigator()]"
      : "[clientDetectors.cookie('locale'), clientDetectors.navigator()]"
  },
  persistence: ${f.context ? "[clientPersistence.localStorage('locale')]" : "[clientPersistence.cookie('locale')]"},`

  const importBlock = f.client
    ? `import { clientDetectors, clientPersistence, createLinguiRouter } from 'rr-lingui'`
    : `import { createLinguiRouter, serverDetectors, serverPersistence } from 'rr-lingui'`

  return `// Auto-generated fixture. ${f.client ? 'Client-only (server: false)' : 'SSR (server: true)'}, mode: ${f.context ? 'context' : 'url-prefix'}.
${importBlock}

export const defaultLocale = 'en'

export const i18n = createLinguiRouter({
${f.client ? clientBlock : serverBlock}
${ignorePaths}
  catalogs: {
${catalogs}
  },
})
`
}

/** @param {Flags} f */
function rootTsx(f) {
  const imports = f.client
    ? `import {
  createLinguiClientMiddleware,
  createLinguiRootLoader,
  createLinguiShouldRevalidate,
  LinguiRouterProvider,
  type LinguiRootLoaderData,
} from 'rr-lingui'`
    : `import {
  createLinguiMiddleware,
  createLinguiRootLoader,
  createLinguiShouldRevalidate,
  LinguiRouterProvider,
  type LinguiRootLoaderData,
} from 'rr-lingui'`

  const exports = f.client
    ? `export const clientMiddleware = [createLinguiClientMiddleware(i18n)]
export const clientLoader = createLinguiRootLoader(i18n)
export const shouldRevalidate = createLinguiShouldRevalidate(i18n)`
    : `export const middleware = [createLinguiMiddleware(i18n)]
export const loader = createLinguiRootLoader(i18n)
export const shouldRevalidate = createLinguiShouldRevalidate(i18n)`

  const loaderHook = f.client ? 'useRouteLoaderData' : 'useRouteLoaderData'

  return `// Auto-generated fixture.
${imports}
import { Links, Meta, Outlet, Scripts, ScrollRestoration, ${loaderHook} } from 'react-router'
import { defaultLocale, i18n } from './lib/i18n'

${exports}

const fallbackLocaleMeta = i18n.locales.find((l) => l.code === defaultLocale)!

export function Layout({ children }: { readonly children: React.ReactNode }) {
  const lingui = ${loaderHook}('root') as LinguiRootLoaderData | undefined
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
  const lingui = ${loaderHook}('root') as LinguiRootLoaderData | undefined
  if (!lingui) return <div>Loading…</div>
  return (
    <LinguiRouterProvider state={lingui}>
      <Outlet />
    </LinguiRouterProvider>
  )
}
`
}

/** @param {Flags} f */
function routesTs(f) {
  return `// Auto-generated fixture.
import { type RouteConfig, index, route } from '@react-router/dev/routes'

${
  f.context
    ? `export default [index('routes/home.tsx'), route('change-locale', 'routes/change-locale.ts')] satisfies RouteConfig`
    : `export default [
  route(':lang?', 'routes/layout.tsx', [index('routes/home.tsx')]),
  route('change-locale', 'routes/change-locale.ts'),
] satisfies RouteConfig`
}
`
}

/** @param {Flags} f */
function rrConfig(f) {
  return `import type { Config } from '@react-router/dev/config'

export default { ssr: ${f.ssr} } satisfies Config
`
}

const configs = {
  'ssr-url-prefix': { ssr: true, context: false, prefix: true, client: false },
  'ssr-context': { ssr: true, context: true, prefix: false, client: false },
  'client-url-prefix': { ssr: false, context: false, prefix: false, client: true },
  'client-context': { ssr: false, context: true, prefix: false, client: true },
}

await rm(fixturesDir, { recursive: true, force: true })

for (const [name, flags] of Object.entries(configs)) {
  const dir = join(fixturesDir, name)
  const app = join(dir, 'app')
  const routes = join(app, 'routes')
  const lib = join(app, 'lib')
  await mkdir(routes, { recursive: true })
  await mkdir(lib, { recursive: true })

  await writeFile(join(dir, 'react-router.config.ts'), rrConfig(flags))
  await writeFile(join(dir, 'vite.config.ts'), viteConfig)
  await writeFile(join(dir, 'tsconfig.json'), tsconfig)
  await writeFile(join(app, 'vite-env.d.ts'), viteEnv)
  await writeFile(join(app, 'root.tsx'), rootTsx(flags))
  await writeFile(join(app, 'routes.ts'), routesTs(flags))
  await writeFile(join(lib, 'i18n.ts'), i18nTsx(flags))
  await writeFile(join(routes, 'home.tsx'), homeTsx)
  await writeFile(join(routes, 'layout.tsx'), layoutTsx)
  await writeFile(join(routes, 'change-locale.ts'), changeLocaleTs(flags))
  await writeFile(join(app, 'entry.client.tsx'), entryClientTsx)
  if (!flags.client) {
    await writeFile(join(app, 'entry.server.tsx'), entryServerTsx)
  }

  console.log('generated', name)
}

console.log('Done. Fixtures written to', fixturesDir)
