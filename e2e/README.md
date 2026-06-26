# E2E tests

Playwright end-to-end tests for `lingui-rr` across **all four configurations**.
Each config runs as its own React Router dev server (one `E2E_CONFIG` + port per
config) and is driven by a dedicated Playwright project. This catches anything
that breaks the library in a real browser — middleware redirects, catalog
rendering, the `/change-locale` action round-trip, and cookie/localStorage
persistence across reloads.

| Config | `server` | `mode` | `prefixDefaultLocale` | Persistence |
| --- | --- | --- | --- | --- |
| `ssr-url-prefix` | `true` | `url-prefix` | `true` | server cookie |
| `ssr-context` | `true` | `context` | — | server cookie |
| `client-url-prefix` | `false` | `url-prefix` | `false` | client cookie |
| `client-context` | `false` | `context` | — | `localStorage` |

## How it works

One fixture app (`app/`) builds four ways. `E2E_CONFIG` selects:

- `react-router.config.ts` → `ssr: true` (SSR) vs `false` (SPA)
- `app/lib/i18n.ts` → detectors/persistence/mode/prefix per config
- `app/root.tsx` → exports `middleware`/`loader` (SSR) or `clientMiddleware`/`clientLoader` (client)
- `app/routes.ts` → `:lang?` layout (url-prefix) vs flat (context)

`playwright.config.ts` starts a dev server per config (ports 3101–3104) and maps
one Playwright project to each, so all four run independently and in parallel.

## Run locally

```sh
# from the repo root
pnpm install
pnpm --filter lingui-rr build                 # e2e imports the built package
pnpm --filter @lingui-rr/e2e install-browsers # one-time: chromium
pnpm --filter @lingui-rr/e2e test
```

To run a single config:

```sh
pnpm --filter @lingui-rr/e2e exec playwright test --project=ssr-url-prefix
```

Dev servers are reused between runs locally (`reuseExistingServer`). On CI they
are started fresh per run.

## CI

GitHub Actions runs the full matrix after building `lingui-rr` (see
`/.github/workflows/verify.yml`, job `e2e`). The e2e job installs Playwright's
chromium and runs all four projects.
