# Contributing to `lingui-rr`

Thank you for your interest in contributing to `lingui-rr`! This guide will help you get set up locally and walk you through our development and publishing workflows.

---

## Local Development Setup

This project uses `pnpm` workspaces for local development and E2E test orchestration.

### Prerequisites

* **Node.js**: `v22.22` or newer (matching `.node-version` / `engines`)
* **pnpm**: `v10.10.0` or newer

### Installation

Install workspace dependencies and set up packages:

```bash
pnpm install
```

### Development Scripts

During development, you can run the following validation scripts:

* **Typechecking**: Validate typescript types across the repository.
  ```bash
  pnpm run typecheck
  ```
* **Building**: Build the library output (`dist/`).
  ```bash
  pnpm run build
  ```
* **Unit Tests**: Run unit tests under `/tests` using Vitest.
  ```bash
  pnpm test
  ```
* **E2E Integration Tests**: Run E2E tests under `/e2e` using Playwright.
  ```bash
  # Install Playwright browsers (first-time setup)
  pnpm --filter @lingui-rr/e2e install-browsers
  
  # Run the E2E tests
  pnpm --filter @lingui-rr/e2e test
  ```

---

## Submitting Changes

1. **Fork and Branch**: Create a new branch named appropriately for your change (e.g., `fix/cookie-parsing` or `feat/custom-detectors`).
2. **Write Tests**: Add unit tests or E2E integration test scenarios to cover your changes.
3. **Verify Locally**: Ensure typechecks, builds, and all tests pass cleanly.
4. **Pull Request**: Open a PR. Fill out the pull request template checklist.

---

## How to Publish

We use the interactive version bumping tool `bumpp` to manage version upgrades, git commits, tags, and pushes in a single, simple command.

### Release Workflow

1. Run the release script in the root directory:
   ```bash
   pnpm release
   ```
2. You will be prompted to choose the version bump type:
   ```txt
   ? Select new version:
   > patch (0.1.1)
     minor (0.2.0)
     major (1.0.0)
     ...
   ```
3. Once you choose the version:
   * The tool updates `"version"` in [package.json](file:///package.json).
   * It creates a git commit (e.g. `v0.1.1`).
   * It tags the commit with the new version (e.g. `v0.1.1`).
   * It pushes both the commit and tag to GitHub.

Our GitHub Actions workflow at [.github/workflows/publish.yml](file:///.github/workflows/publish.yml) will automatically run, build the package, and publish it to the npm registry.