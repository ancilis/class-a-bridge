# Test-results report

Evidence snapshot date: 2026-07-18  
Target: Class A Bridge 0.9.0 Public Beta  
Pinned runtime: Node.js 24.18.0, pnpm 10.33.0  
Working-tree base commit: `e490a3c856073f1fe4b9703f2ffc0c59d43e4601`  
Final release commit: **PENDING**

## Decision

**Automated release-candidate verification passed.** The evidence supports a
public-beta recommendation. It does not support 1.0.0 because qualified guidance
review, substantive package review, manual accessibility/usability review,
real-hardware verification, and final release-manager sign-off remain pending.

Repeated executions below intentionally run the same tests more than once. They
must not be added to the 349-test unique workspace total.

## Integrated workspace results

| Workspace                     |  Files |       Tests | Result     |
| ----------------------------- | -----: | ----------: | ---------- |
| `@class-a-bridge/bridge`      |     17 |       97/97 | Passed     |
| `@class-a-bridge/project`     |      — |       88/88 | Passed     |
| `@class-a-bridge/documents`   |      — |       29/29 | Passed     |
| `@class-a-bridge/rules`       |      — |       19/19 | Passed     |
| `@class-a-bridge/website`     |      — |       40/40 | Passed     |
| `@class-a-bridge/contact-api` |      — |       60/60 | Passed     |
| `@class-a-bridge/schemas`     |      — |         5/5 | Passed     |
| `@class-a-bridge/testing`     |      — |         8/8 | Passed     |
| `@class-a-bridge/ui`          |      — |         3/3 | Passed     |
| **Complete workspace**        | **46** | **349/349** | **Passed** |

## Stability evidence

| Scope                                                               | Result                                        | Evidence                 |
| ------------------------------------------------------------------- | --------------------------------------------- | ------------------------ |
| Three affected full-application files, ten consecutive grouped runs | 120/120 passed across 30 file executions      | `TEST_FLAKE_ANALYSIS.md` |
| Complete bridge suite, five consecutive constrained runs            | 485/485 passed across 85 file executions      | `TEST_FLAKE_ANALYSIS.md` |
| Complete workspace, three forced uncached constrained runs          | 1,047/1,047 passed across 138 file executions | `TEST_FLAKE_ANALYSIS.md` |
| Complete bridge suite with shuffled order, seed `20260718`          | 97/97 passed across 17 files                  | `TEST_FLAKE_ANALYSIS.md` |

The correction constrains the memory-heavy jsdom suite, narrows full-application
test seams, and removes unnecessary work. No global or targeted timeout was
increased.

## Browser, accessibility, privacy, and integrity results

| Gate                                         | Result                                                                        | Evidence                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Production Playwright end-to-end matrix      | 21/21 passed                                                                  | `reports/release/BROWSER_TEST_REPORT.md`                                                   |
| Chromium accessibility/keyboard suite        | 4/4 passed; no automatically detectable WCAG A/AA violations in covered flows | `reports/release/ACCESSIBILITY_REPORT.md`                                                  |
| Cross-browser smoke and privacy canary       | Passed in Chromium, Firefox, and WebKit                                       | `reports/release/BROWSER_TEST_REPORT.md`; `reports/release/PRIVACY_NETWORK_TEST_REPORT.md` |
| Regulatory integrity                         | 62 rules checked: 61 PASS, 1 exact documented upstream inconsistency, 0 FAIL  | `reports/regulatory/regulatory-integrity.md`                                               |
| Rule-selection audit                         | Automated source-to-selection checks passed; qualified human review pending   | `reports/regulatory/rule-selection-audit.md`                                               |
| Schema manifest/checksum verification        | 3/3 manifest verification checks passed; schema package 5/5 tests passed      | `packages/schemas/tests/`; `packages/schemas/src/manifest.ts`                              |
| Release integrity scan before final assembly | 699 files and 4 archives scanned; 0 active findings                           | `reports/release/release-integrity.md`                                                     |
| Production dependency audit                  | 0 high or critical findings                                                   | `reports/release/dependency-audit.md`                                                      |
| Production dependency inventory/SBOM         | 38 components; CycloneDX SBOM generated                                       | `reports/release/license-summary.md`; `reports/release/sbom.cdx.json`                      |

## Source-release result

The top-level `pnpm verify:source-archive` wrapper passed for the candidate in
63.4 seconds. It extracted source without `.git`, installed from the frozen
lockfile, ran the full 349-test verification and production build, assembled the
release, inspected the manifest, and confirmed no `git init` occurred. Evidence
is in `dist/release-evidence/source-archive-verification.json`. A final-commit
replay and final archive checksums remain pending until the release commit is
created. See `SOURCE_RELEASE_REPRODUCIBILITY.md`.

## Checks passed on the current candidate

- formatting;
- lint;
- TypeScript checking;
- 349/349 workspace tests;
- regulatory and schema integrity;
- production build and 21/21 production browser tests;
- three-browser cross-browser/privacy checks;
- 4/4 automated accessibility checks;
- release integrity, dependency audit, license inventory, and SBOM generation.

These results describe the current release candidate. The mechanical final-commit
replay and archive checksum stamping must be recorded before publication.

## Exact verification commands

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test

for run_index in $(seq 1 10); do
  pnpm --filter @class-a-bridge/bridge exec vitest run \
    tests/evidence-metadata.test.tsx \
    tests/package-freshness.test.tsx \
    tests/validation-navigation.test.tsx \
    --maxWorkers=1 --no-file-parallelism --reporter=dot
done

for run_index in $(seq 1 5); do
  pnpm --filter @class-a-bridge/bridge exec vitest run \
    --maxWorkers=1 --no-file-parallelism --reporter=dot
done

for run_index in $(seq 1 3); do
  TURBO_FORCE=true pnpm exec turbo run test \
    --concurrency=1 --output-logs=errors-only
done

pnpm --filter @class-a-bridge/bridge exec vitest run \
  --sequence.shuffle --sequence.seed=20260718 --reporter=dot
pnpm test:e2e
pnpm test:a11y
pnpm test:cross-browser
pnpm release:integrity
pnpm release:supply-chain
```

## Human and operational gates still pending

- qualified technical, compliance, and claims review of all 62 Draft mapping
  playbooks;
- substantive human review of generated package representations and structure;
- moderated usability testing;
- manual keyboard, screen-reader, zoom, reflow, print, and tablet review;
- real-hardware browser, progressive-web-app, persistence, and offline review;
- public deployment and production HTTPS/header/contact-endpoint validation;
- final commit, release-manager approval, archive creation, and final checksums.
