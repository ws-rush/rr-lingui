# Installation & Setup

To get started, you'll need to install `lingui-rr` along with its peer dependencies: Lingui core/react packages and the required build-time tooling.

## 1. Install Dependencies

Use your package manager to install the packages:

::: code-group

```sh [pnpm]
pnpm add lingui-rr @lingui/core @lingui/react
pnpm add -D @lingui/cli @lingui/conf @lingui/vite-plugin @lingui/format-po
```

```sh [npm]
npm install lingui-rr @lingui/core @lingui/react
npm install --save-dev @lingui/cli @lingui/conf @lingui/vite-plugin @lingui/format-po
```

```sh [yarn]
yarn add lingui-rr @lingui/core @lingui/react
yarn add --dev @lingui/cli @lingui/conf @lingui/vite-plugin @lingui/format-po
```

:::

---

## 2. Configure Lingui

Create a `lingui.config.ts` (or `.js`) at the root of your project. This defines where message catalogs are located, the supported languages, fallback locales, and translation formats.

```ts
// lingui.config.ts
import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'

export default defineConfig({
  catalogs: [
    {
      // Exclude build/asset folders and environment definitions
      exclude: ['**/app/locales', '**/app/*-env.d.ts'],
      include: ['app'],
      path: 'app/locales/{locale}',
    },
  ],
  fallbackLocales: { default: 'en' },
  format: formatter({ origins: false }),
  locales: ['en', 'ar'],
  sourceLocale: 'en',
})
```

---

## 3. Configure Vite

Enable the `@lingui/vite-plugin` alongside the React Router Vite plugin in `vite.config.ts`. The Lingui plugin automatically compiles your translation files at build time and permits dynamic imports.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { reactRouter } from '@react-router/dev/vite'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    reactRouter(),
    lingui(), // [!code focus]
  ],
})
```

With these steps completed, your project is ready to compile and load translation catalogs. Next, let's look at how to structure and integrate the router in different architectural configurations.
