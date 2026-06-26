# API Reference

This page contains the signatures, parameters, and descriptions for all exported functions and hooks in `lingui-rr`.

---

## Core Factories

### `createLinguiRouter`
Instantiates a Lingui-React Router integration router.

```ts
function createLinguiRouter(config: LinguiRouterConfig): LinguiRouterInstance
```
* **Parameters**: `config` (see [Configuration Reference](./configuration)).
* **Returns**: A router instance used by the middleware, loaders, and actions. Do not consume this instance directly in UI rendering; access it via hooks.

---

## Route Middleware & Loaders

### `createLinguiMiddleware`
Creates a server-side middleware function to run in the root route's `middleware` pipeline. Only valid when `server: true`.

```ts
function createLinguiMiddleware(router: LinguiRouterInstance): MiddlewareFunction
```

### `createLinguiClientMiddleware`
Creates a client-side middleware function for client-only / SPA builds. Only valid when `server: false`.

```ts
function createLinguiClientMiddleware(router: LinguiRouterInstance): ClientMiddlewareFunction
```

### `createLinguiRootLoader`
Creates the root route loader function. It extracts the detected locale, imports the corresponding translation catalog, and returns a serializable state tree.

```ts
function createLinguiRootLoader(router: LinguiRouterInstance): LoaderFunction
```
* **Returns**: A loader function. In your route files, type your layout hook as `useLoaderData<typeof loader>()` or `useRouteLoaderData<typeof loader>('root')` to resolve to the type-safe `LinguiState` shape.

---

## Actions & Revalidation

### `createLocaleAction`
Creates an action route handler to process locale updates.

```ts
function createLocaleAction(router: LinguiRouterInstance): ActionFunction
```
* **Expected Request Payload**:
  * `locale`: The code of the target locale to switch to.
  * `redirectTo`: The path to redirect to after persisting the selection.
* **Returns**: A response directing the browser to the redirected path with updated cookie/session headers.

### `createLinguiShouldRevalidate`
Creates a custom revalidation strategy for React Router.

```ts
function createLinguiShouldRevalidate(
  router: LinguiRouterInstance,
  options?: { actionPath?: string }
): ShouldRevalidateFunction
```
* **Options**:
  * `actionPath`: The route path of your locale action (defaults to `"/change-locale"`).
* **Behavior**: Returns `true` (triggering revalidation) when a POST request is sent to `actionPath` or when the URL pathname changes. Prevents unnecessary dictionary re-fetching on simple query-parameter changes.

---

## React Providers & Hooks

### `LinguiRouterProvider`
Hydrates the client-side Lingui provider with translation catalogs and configures the active locale context. Wrap your root layout component with this provider.

```tsx
function LinguiRouterProvider(props: {
  state: LinguiState
  children: React.ReactNode
}): React.JSX.Element
```
* **Props**:
  * `state`: The serialized Lingui state returned from your root loader (type `LinguiState`).
  * `children`: Component subtree that needs access to translation context and macros (e.g. `<Trans>`).

### `useLinguiRouter`
Reads active localization metadata and routing parameters. Must be invoked within a component wrapped by `LinguiRouterProvider`.

```ts
function useLinguiRouter(): {
  locale: string
  localeMeta: { code: string; label: string; dir: 'ltr' | 'rtl' | 'auto' }
  locales: Array<{ code: string; label: string; dir: 'ltr' | 'rtl' | 'auto' }>
  messages: Messages
  htmlAttrs: { lang: string; dir: 'ltr' | 'rtl' | 'auto' }
}
```

---

## Path Rewriting & Utilities

### `rewriteLocalePath`
Pure function that rewrites absolute URL paths to target a specific locale prefix.

```ts
function rewriteLocalePath(
  path: string,
  targetLocale: string,
  supportedLocales: readonly string[],
  options?: {
    defaultLocale?: string
    prefixDefaultLocale?: boolean
    ignorePaths?: Array<RegExp | string>
  }
): string
```
* **Parameters**:
  * `path`: Absolute URL path (e.g. `/dashboard?tab=1#main`).
  * `targetLocale`: The locale to apply to the prefix (matched case-insensitively).
  * `supportedLocales`: Array of configured locale codes.
  * `options`: If omitting the prefix for the default locale, supply `defaultLocale` and set `prefixDefaultLocale: false`. If a path matches `ignorePaths`, it is returned unchanged.

```ts
rewriteLocalePath('/about', 'en', ['en', 'ar']) // "/en/about"
rewriteLocalePath('/en/about', 'ar', ['en', 'ar'], { defaultLocale: 'ar', prefixDefaultLocale: false }) // "/about"
```

### `getHtmlAttrs`
Generates lang/direction attributes for a specific locale.
```ts
function getHtmlAttrs(
  locale: string | LocaleMeta,
  locales?: readonly LocaleMeta[]
): { lang: string; dir: 'ltr' | 'rtl' | 'auto' }
```

### `getLocaleDir`
Resolves the rendering direction for a locale.
```ts
function getLocaleDir(
  locale: string | LocaleMeta,
  locales?: readonly LocaleMeta[]
): 'ltr' | 'rtl' | 'auto'
```

### `getLocaleLabel`
Resolves the human-readable label of a locale.
```ts
function getLocaleLabel(
  locale: string | LocaleMeta,
  locales?: readonly LocaleMeta[]
): string
```
