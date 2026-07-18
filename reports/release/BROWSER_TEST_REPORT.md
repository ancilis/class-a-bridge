# Browser and production-build verification report

Evidence snapshot date: 2026-07-18  
Target: Class A Bridge 0.9.0 Public Beta  
Final release commit/checksum: **PENDING**

## Decision

**Automated production-build browser verification passed: 21/21 Playwright test
executions.** Chromium exercised the complete production flow; Firefox and WebKit
exercised the cross-browser workspace smoke and privacy-canary flow. Manual
real-hardware Safari, installed-PWA, persistence, and offline-restart review
remains pending and blocks 1.0.0.

## Automated browser matrix

| Browser   | Production test coverage       | Cross-browser smoke  | Privacy canary       | Offline/PWA automation          | Result                 |
| --------- | ------------------------------ | -------------------- | -------------------- | ------------------------------- | ---------------------- |
| Chromium  | Full production suite, 17/17   | Passed               | Passed               | Offline shell passed            | Passed                 |
| Firefox   | Targeted production suite, 2/2 | Passed               | Passed               | Not included in targeted matrix | Passed with limitation |
| WebKit    | Targeted production suite, 2/2 | Passed               | Passed               | Not included in targeted matrix | Passed with limitation |
| **Total** | **21/21**                      | **3 engines passed** | **3 engines passed** | **Chromium automated**          | **Passed**             |

The production suite covers first run, the explained eight-question result,
fictional sample, requirement/evidence/package flows, project lifecycle, local
privacy, offline shell behavior, screenshots, accessibility, and core workspace
navigation. Firefox and WebKit are intentionally scoped by `playwright.config.ts`
to `cross-browser.spec.ts` and `privacy-network.spec.ts`.

## Commands

```sh
pnpm test:e2e
pnpm test:cross-browser
pnpm test:a11y
```

Evidence sources:

- `playwright.config.ts`
- `e2e/`
- `reports/release/PRIVACY_NETWORK_TEST_REPORT.md`
- `reports/release/ACCESSIBILITY_REPORT.md`

## Manual hardware matrix

| Environment                                 | Ordinary browser | Installed PWA   | Offline restart | Persistence/restore | Status  |
| ------------------------------------------- | ---------------- | --------------- | --------------- | ------------------- | ------- |
| Chromium desktop on representative hardware | Required         | Required        | Required        | Required            | Pending |
| Firefox desktop on representative hardware  | Required         | Where supported | Required        | Required            | Pending |
| Safari/WebKit on supported Apple hardware   | Required         | Where supported | Required        | Required            | Pending |

The operator procedure is in `docs/release/MANUAL_RELEASE_VERIFICATION.md`.
No browser version, operating system, hardware profile, screenshot observation,
or manual result has been fabricated.

## Public deployment

| Check                                                          | Status                    | Evidence                       |
| -------------------------------------------------------------- | ------------------------- | ------------------------------ |
| Local production build and Playwright preview                  | Passed                    | 21/21 Playwright result        |
| Combined site serves website at `/` and application at `/app/` | Pending public deployment | No production URL assigned     |
| HTTPS, secure headers, and deployed CSP                        | Pending public deployment | No production header capture   |
| Mixed-content and deployed asset review                        | Pending public deployment | No production URL assigned     |
| Installed PWA and offline restart on real hardware             | Pending manual review     | Operator script not completed  |
| Deployed contact success/failure flow                          | Pending public deployment | Endpoint not deployed/observed |
| Canonical URLs and legal-route crawl                           | Pending public deployment | No production URL assigned     |

Deployment success is not inferred from a local production build.

## Release interpretation

- Automated multi-engine browser gate: **Passed**.
- Automated production end-to-end gate: **Passed, 21/21**.
- Manual real-hardware/browser/PWA gate: **Pending; disclosed beta limitation and
  1.0.0 blocker**.
- Public deployment verification: **Pending**.
- Final commit and production-build checksum: **Pending**.
