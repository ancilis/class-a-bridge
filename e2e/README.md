# Browser quality suite

This Playwright suite runs the production Bridge build and covers the release-critical browser paths:

- account-free first run and the eight-question preliminary result;
- result changes with visible deterministic rationale;
- fictional sample workspace and all primary destinations;
- SOC 2 mapping, local evidence metadata/file handling, and KSI narratives;
- package download and pinned-schema validation status;
- project export, deletion, import, and record restoration;
- a private-data network canary during normal assessment work;
- production service-worker offline behavior;
- keyboard focus, programmatic control labels, and axe WCAG A/AA checks;
- Chromium, Firefox, and WebKit smoke coverage;
- release screenshot capture under `docs/screenshots`.

## Required development dependencies

The repository root should declare compatible pinned versions of:

```text
@playwright/test
@axe-core/playwright
```

Then install browser engines and run the suite:

```sh
pnpm exec playwright install chromium firefox webkit
pnpm exec playwright test
```

The root `test:e2e` script should call `playwright test` directly (or otherwise include this root suite). The tests intentionally fail when generated sample JSON is not structurally valid or an editable control lacks a programmatic label.

Set `PLAYWRIGHT_BASE_URL` to use an already-running deployment. Otherwise, the configuration builds and previews `@class-a-bridge/bridge` on `127.0.0.1:4173`.
