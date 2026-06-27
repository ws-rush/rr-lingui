# Introduction

`lingui-rr` is a specialized integration layer that bridges **Lingui** (the translation library) and **React Router v8 (Framework Mode)**. It handles the complexities of internationalization (i18n), locale routing, detection, and state serialization with zero-friction types.

## Core Concept & Mental Model

To understand how `lingui-rr` works, it is best to trace the lifecycle of a user request from the initial network hit down to rendering a translated page in the browser:

```txt
[User Request]
      │
      ▼
┌──────────────┐
│  Middleware  │ ──► 1. Detects locale (URL prefix, cookies, or headers)
└──────────────┘     2. Pre-loads translation catalog asynchronously
      │
      ▼
┌──────────────┐
│ Root Loader  │ ──► 3. Retrieves state & catalog from middleware context
└──────────────┘     4. Returns serializable JSON payload to React Router
      │
      ▼
┌──────────────┐
│   Provider   │ ──► 5. Binds active locale & catalog to Lingui
└──────────────┘     6. Renders children with standard <Trans> macros
```

### The Three Pillars:

1. **Middleware (Detection & Pre-loading)**: Intercepts incoming requests early in the routing cycle. In URL-Prefix mode, it parses the path prefix (e.g. `/en/about` -> locale is `en`, target path is `/about`). In Context mode, it inspects cookies or headers. It then fetches/imports the appropriate language catalog before rendering starts.
2. **Root Loader (Serialization & Handshake)**: Bridges the router state with the React component tree. Because React Router requires all loader data to be JSON-serializable, `lingui-rr` wraps loader data in a safe layout that preserves the catalog type definition, preventing React Router from widening complex compiled translation types.
3. **Provider (Context & Hydration)**: Receives the serialized state and hydrates the client-side Lingui provider. Once wrapped in `LinguiRouterProvider`, standard components like the `<Trans>` macro can render translations immediately without hydration mismatches or page flashes.

---

## Why `lingui-rr`?

Implementing robust internationalization in React Router (especially under framework mode with Server-Side Rendering) introduces several challenges that `lingui-rr` solves out-of-the-box:

1. **URL Prefixing without Code Duplication**
   In standard routing, mapping paths like `/` to Arabic and `/en` to English typically forces you to duplicate route folders or create complex wrappers. `lingui-rr` uses middleware and route-rewriting to run BCP-47 locale prefixes (e.g. `/en/about`, `/about`) into a single optional parameters route tree (`:lang?`).

2. **Hydration Mismatch Mitigation**
   With Server-Side Rendering (SSR), the server and client must agree on the selected locale and compiled translations before rendering begins. `lingui-rr` runs locale detection in middleware and propagates the active locale state via React Router loaders, ensuring the initial HTML matches the hydrated client exactly.

3. **Type Serialization Safety (Zero-Cast)**
   React Router loader data undergoes serialization, which strips runtime-only properties and widens complex types. Lingui's compiled message catalogs contain token tuples that React Router's `SerializeFrom` utility would widen. `lingui-rr` loaders preserve these shapes, allowing you to use `useLoaderData<typeof loader>()` without needing unsafe `as LinguiState` type-casts.

4. **Flexible Detection & Persistence**
   A pluggable detection and persistence pipeline lets you choose where your locale state comes from (Cookies, Headers, localStorage, Navigator languages) and where it persists, depending on whether you run SSR or Client-only/SPA applications.

---

## Key Integration Modes

`lingui-rr` supports two primary routing configurations:

- **URL-Prefix Mode (`mode: 'url-prefix'`)**: The active locale is represented in the URL path (e.g., `/en/about` vs `/about`). Best for SEO.
- **Context Mode (`mode: 'context'`)**: The URL remains clean (e.g., `/about`), and the locale is stored entirely in cookies, headers, or localStorage.

It also distinguishes between running environments:

- **Server-Side Rendered (`server: true`)**: Relies on server-side detectors and persistence (headers, sessions).
- **Client-Only / SPA (`server: false`)**: Relies on browser-based detectors (navigator, localStorage, document.cookie).
