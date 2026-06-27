# lingui-rr

React Router v8 framework-mode integration for Lingui.

[![Stand With Palestine](https://raw.githubusercontent.com/Safouene1/support-palestine-banner/master/StandWithPalestine.svg)](https://stand-with-palestine.org)
[![Documentation](https://img.shields.io/badge/docs-lingui--rr.wusaby.com-blue)](https://lingui-rr.wusaby.com)
[![npm version](https://img.shields.io/npm/v/lingui-rr.svg)](https://www.npmjs.com/package/lingui-rr)

---

`lingui-rr` is a specialized integration layer that bridges **Lingui** and **React Router v8 (Framework Mode)**. It handles the complexities of internationalization (i18n), locale routing, detection, and state serialization with zero-friction types.

For complete documentation, guides, and API reference, visit [lingui-rr.wusaby.com](https://lingui-rr.wusaby.com).

## Key Features

- 🌐 **URL-Prefix & Context Modes**: Route locales seamlessly via URL paths (e.g., `/en/about` vs `/about` with prefix hiding) or keep URLs clean using cookie/header detection.
- ⚡ **Zero-Cast React Integration**: Prevents React Router type widening, avoiding messy `as LinguiState` assertions on loader data.
- 🔄 **SSR & SPA Support**: Optimizations and configurations for Server-Side Rendered (`server: true`) and client-only Single Page Apps (`server: false`).
- 🛡️ **Built-in Redirection & Fallbacks**: Automatic validation of locale prefixes with regional fallbacks (e.g. `en-US -> en` and `ar-PS -> ar`) and unlocalized asset exclusion.
- ⚙️ **Pluggable Pipelines**: Customizable detector and persistence flows (Cookies, Headers, Session Storage, localStorage, Navigator).

## Installation

```sh
pnpm add lingui-rr @lingui/core @lingui/react
pnpm add -D @lingui/cli @lingui/conf @lingui/vite-plugin @lingui/format-po
```

## Quick Preview

Define your router setup in a shared i18n file, including regional variations like Palestinian Arabic (`ar-PS`):

```ts
// app/lib/i18n.ts
import {
  createLinguiRouter,
  clientDetectors,
  clientPersistence,
} from 'lingui-rr'

export const i18n = createLinguiRouter({
  server: false,
  mode: 'url-prefix',
  defaultLocale: 'ar',
  locales: {
    ar: { label: 'العربية', dir: 'rtl' },
    'ar-PS': { label: 'العربية (فلسطين)', dir: 'rtl' },
    en: { label: 'English', dir: 'ltr' },
  },
  detection: [clientDetectors.cookie('locale'), clientDetectors.navigator()],
  persistence: [clientPersistence.cookie('locale')],
  catalogs: {
    ar: () => import('../locales/ar.po'),
    'ar-PS': () => import('../locales/ar.po'),
    en: () => import('../locales/en.po'),
  },
})
```

Integrate into `app/root.tsx`:

```tsx
// app/root.tsx
import {
  createLinguiRootLoader,
  createLinguiClientMiddleware,
  LinguiRouterProvider,
} from 'lingui-rr'
import { Outlet, useLoaderData } from 'react-router'
import { i18n } from './lib/i18n'

export const clientMiddleware = [createLinguiClientMiddleware(i18n)]
export const clientLoader = createLinguiRootLoader(i18n)

export default function App() {
  const state = useLoaderData<typeof clientLoader>()
  return (
    <LinguiRouterProvider state={state}>
      <Outlet />
    </LinguiRouterProvider>
  )
}
```

## Documentation

Full documentation is hosted at **[lingui-rr.wusaby.com](https://lingui-rr.wusaby.com)**. Please refer to the site for:

- **[Getting Started & Concept Mental Model](https://lingui-rr.wusaby.com/guide/introduction)**: Understand the middleware-loader-provider lifecycle.
- **[Step-by-Step Tutorials](https://lingui-rr.wusaby.com/guide/lesson-1-ssr-url-prefix)**:
  - SSR with URL Prefixes
  - Client-Only/SPA with URL Prefixes
  - SSR in Context Mode (unprefixed URLs)
  - Client-Only/SPA in Context Mode
- **[Configuration Reference](https://lingui-rr.wusaby.com/reference/configuration)**: Complete options for `createLinguiRouter` including ignored paths, fallback behaviors, and regional fallbacks.
- **[API Reference](https://lingui-rr.wusaby.com/reference/api)**: Detailed specifications for middleware factories, loaders, hooks (`useLinguiRouter`), actions (`createLocaleAction`), and path rewriting helpers (`rewriteLocalePath`).
- **[Advanced Options & Integration](https://lingui-rr.wusaby.com/reference/glossary)**: Custom cookie attributes, session persistence using React Router's SessionStorage, and catalog compiler formats.

## Support Palestine 🇵🇸

We stand in solidarity with the people of Palestine. We condemn the ongoing genocide, military occupation, and humanitarian catastrophe. Learn more and find resources documenting the situation at [stand-with-palestine.org](https://stand-with-palestine.org) and the names of the victims at [visualizingpalestine.org](https://visualizingpalestine.org/gaza-names/en.html).
