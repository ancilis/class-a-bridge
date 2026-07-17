# Class A Bridge 1.0.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-ready open-source marketing site and local-first browser product that turns a confirmed SOC 2 Type II starting point into an explainable FedRAMP 20x Class A preparation workspace and exportable package scaffold.

**Architecture:** A pnpm/Turborepo monorepo separates the statically exported website from the offline Vite/React PWA. Shared packages own UI, dated regulatory content, official schemas, the portable project model, document generation, and fixtures. All assessment data processing, persistence, cryptography, validation, and export occurs in the browser.

**Tech stack:** TypeScript, React, Next.js static export, Vite with an explicit service worker and hash-based in-app navigation, Zod, `idb`, PDF.js, AJV standalone validators, fflate, Web Crypto, browser print/PDF, minimal Open XML DOCX generation, Vitest, React Testing Library, Playwright, axe-core, ESLint, Prettier, pnpm, and Turborepo.

---

## File map

- Root configuration owns workspace scripts, quality gates, policies, and public-repository documentation.
- `apps/bridge/src/App.tsx` owns the application shell and guided screens; `src/lib/*` owns PDF processing, storage/backup orchestration, downloads, and deterministic workspace derivations.
- `apps/website/app` owns static routes; `content/*` owns reusable editorial data; `components/*` owns website composition.
- `packages/rules/src/catalog` contains one normalized registry; `scripts/compare-official.ts` is the only update entry point.
- `packages/schemas/vendor` contains untouched official JSON; `src` contains metadata and validator wiring.
- `packages/project/src/model.ts` defines portable types; `storage.ts`, `bundle.ts`, `migrations.ts`, `redaction.ts`, and `security.ts` are separate trust-boundary modules.
- `packages/documents/src` defines artifact models and pure serializers; serializers cannot read browser storage directly.
- `packages/testing/src/acme.ts` owns the fictional sample record.

## Task 1: Repository and quality foundation

**Files:** root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, ESLint/Prettier configuration, `.gitignore`, `.npmrc`, `.nvmrc`; application package manifests for website, bridge, and optional contact endpoint.

- [ ] Pin Node and pnpm engines; declare `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`, `test:a11y`, `verify`, `rules:compare`, and `schemas:verify` scripts.
- [ ] Add workspace packages and deterministic lockfile.
- [ ] Configure strict TypeScript with `noUncheckedIndexedAccess`, exact optional properties, and browser-safe module resolution.
- [ ] Run `pnpm install`, `pnpm typecheck`, and `pnpm lint`; expect zero errors before feature work.
- [ ] Commit as `chore: initialize class a bridge monorepo`.

## Task 2: Official rule registry and schemas

**Files:** `packages/rules/**`, `packages/schemas/**`, registry and validator tests.

- [ ] Write failing registry tests that require unique IDs, the 23 named mandatory records, official/guidance separation, source URL, dates, mappings, questions, evidence examples, owner, scope concerns, and change history.
- [ ] Vendor catalog `2026.07.14.01` at commit `12fe1b60f578ab448c26d143baac99d16d8bfe14` and all eleven official June 24-named schemas; write manifests with URL, retrieval date, byte size, SHA-256, `$id`, `$schemaVersion`, and `localChanges: "none"`.
- [ ] Build typed catalog records for prerequisites, external-framework rules, mandatory, recommended, optional, package-overview, and Security Decision Record rules; preserve and flag the `FRC-CLA-RFR` / `CPO-CSF-CPM` applicability inconsistency.
- [ ] Add plain-language guidance and seven dedicated KSI workflow definitions.
- [ ] Implement AJV 2020 validators with local `$ref` resolution and friendly JSON-pointer issues.
- [ ] Add a compare command that downloads to a temporary directory, prints normalized differences, and requires `--approve` to replace content.
- [ ] Run `pnpm --filter @class-a-bridge/rules test` and `pnpm --filter @class-a-bridge/schemas test`; expect all integrity checks to pass.

## Task 3: Project model, migrations, sample, and eligibility evaluator

**Files:** `packages/project/src/model/**`, `migrations/**`, `eligibility/**`, `packages/testing/src/fixtures/acme-metrics.ts`.

- [ ] Write failing tests for project parsing, unknown-field rejection at trust boundaries, v1 migration, eligibility classifications, explanation provenance, and the eight-answer early-result limit.
- [ ] Define `BridgeProject`, resource, relationship, material, requirement work, SOC 2, mapping, evidence, action, output, approval, and snapshot schemas.
- [ ] Implement deterministic eligibility evaluation with typed findings, supporting answer IDs, rules, certainty, unresolved evidence, blockers, and three actions.
- [ ] Create a complete Acme Metrics sample with mixed requirement states, mappings, exceptions, evidence, scope, actions, generated-output examples, validation results, and advisor flags.
- [ ] Enforce “Fictional example — not for submission” in sample metadata and all sample serializers.
- [ ] Run model, migration, evaluator, and fixture tests; expect no invalid sample records.

## Task 4: Local persistence, crypto, hashing, bundles, and deletion

**Files:** `packages/project/src/storage/**`, `security/**`, `bundle/**`, and tests.

- [ ] Write failing adapter contract tests for save/load/list/delete/delete-all, IndexedDB failure fallback, attachment handling, and last-save metadata.
- [ ] Implement Dexie project/attachment tables and metadata-only localStorage fallback behind one interface.
- [ ] Add browser SHA-256 and safe filename helpers.
- [ ] Implement standard ZIP export with manifest and checksums; reject traversal paths, duplicate paths, unsafe ratios, too many entries, oversized expansions, and invalid manifests on import.
- [ ] Implement PBKDF2/AES-GCM encrypted envelopes and wrong-password/tamper errors without leaking secret values.
- [ ] Implement explicit advisor redaction and attachment inclusion lists.
- [ ] Verify byte-for-byte project round trips and that delete-all removes every database/localStorage key owned by the app.

## Task 5: Shared accessible design system

**Files:** `packages/ui/src/**`, Story/test fixtures, `tokens.css`, print styles.

- [ ] Write interaction tests for buttons, fields, radio cards, dialogs, disclosure, status chips, alerts, progress milestones, error summaries, and navigation.
- [ ] Implement centralized neutral/navy/teal tokens, text-labeled status colors, spacing, typography, focus rings, motion preferences, and print variables.
- [ ] Ensure dialogs trap and restore focus, disclosures expose state, errors link to fields, and live regions announce saves/results.
- [ ] Run axe against component fixtures and verify all controls at 200% zoom.

## Task 6: Bridge shell, onboarding, and early assessment

**Files:** `apps/bridge/src/app/**`, `features/onboarding/**`, `features/eligibility/**`, PWA configuration and tests.

- [ ] Write browser tests for the three first-run paths, no account wall, manual start, sample start, eight-question result, answer revision, and understandable changed rationale.
- [ ] Build the responsive ten-destination shell, skip link, privacy indicator, save state, project switch/reset guard, and offline banner.
- [ ] Implement one-question-at-a-time radio cards with why/example/strong-answer/owner/blocker guidance and a “Not sure” choice.
- [ ] Render result classification, reasons, supporting answers, blockers, missing information, next three actions, official references, certainty, human-review needs, and disclaimer.
- [ ] Configure manifest, icons, service worker, update prompt, static asset caching, and offline navigation fallback.

## Task 7: Local SOC 2 PDF import and mapping model

**Files:** `features/soc2-import/**`, `packages/project/src/pdf/**`, `features/soc2-materials/**`, `features/mappings/**`.

- [ ] Write fixture tests for text PDF, image-only, encrypted, malformed, oversized, and pattern confidence cases.
- [ ] Integrate local PDF.js worker with scripting disabled, type/size validation, normalized text pages, and no network fetch.
- [ ] Implement deterministic candidate extraction and confirmation cards with value, page, snippet, confidence, and confirm/edit/ignore.
- [ ] Build the manual fallback and external-material freshness checklist.
- [ ] Implement many-to-many control/TSC/page/test/result/exception/rule/evidence/narrative mappings with suggested reasons and mandatory confirmation.
- [ ] Verify no extraction or mapping changes a requirement to complete.

## Task 8: Scope, requirements, seven KSI flows, and evidence

**Files:** `features/scope/**`, `features/requirements/**`, `features/evidence/**`.

- [ ] Build a list-and-relationship scope editor with resource types, federal-data/impact flags, exclusions, third parties, SOC 2 alignment, summaries, and technical-confirmation questions.
- [ ] Build catalog filtering and requirement work records with every requested narrative, mapping, evidence, owner, date, note, question, exception, acceptance, completion, and review field.
- [ ] Build dedicated flows for logging changes, network traffic, training review, account automation, passwordless methods, incident-response review, and information security.
- [ ] Implement evidence metadata, attachment/reference choices, local hashing, sensitivity labels, review state, freshness calculation, and “evidence candidate” wording.
- [ ] Add actionable empty and error states and deep links from every blocker.

## Task 9: Action plan, reports, package, and final review

**Files:** `features/action-plan/**`, `features/reports/**`, `features/package/**`, `packages/documents/**`.

- [ ] Write artifact snapshot tests, malicious-content escaping tests, CSV formula tests, filename tests, JSON-schema validation tests, ZIP structure tests, and sample watermark tests.
- [ ] Generate prioritized typed actions from blockers, scope, implementation, evidence, confirmation, approval, recommended, and optional categories.
- [ ] Implement editable owner/date/status/filter views plus CSV, executive, and print exports.
- [ ] Generate Certification Package Overview, Security Decision Record, Ongoing Certification Report, SOC 2 mapping, evidence manifest, scope, open items, index, source/schema manifest, validation, approval, disclaimer, and advisor handoff artifacts.
- [ ] Validate official JSON in-browser and render friendly errors with section links, expected/current values, and resolution guidance.
- [ ] Generate numbered package ZIP directories without evidence binaries by default.
- [ ] Implement immutable final-review snapshots, freshness, missing references/placeholders/approvals, version/approver/dates, checklist, and provider-submission reminder.

## Task 10: Data management and diagnostics

**Files:** `features/settings/**`, `features/diagnostics/**`.

- [ ] Show storage backend, approximate size, last save, attachments, catalog/schema versions, and privacy documentation.
- [ ] Wire standard, password-protected, and redacted exports; import preview/migration; project deletion; and all-data deletion confirmations.
- [ ] Generate a downloadable diagnostic JSON containing versions, capability flags, error codes, and sanitized stack locations but no project values or filenames.
- [ ] Test cancellation, wrong passwords, unsupported migrations, corrupt bundles, unavailable storage, and recovery without state loss.

## Task 11: Complete marketing, guidance, documentation, and legal website

**Files:** `apps/website/app/**`, `components/**`, `content/**`, metadata, sitemap, robots, contact adapter.

- [ ] Implement the exact homepage hero and seven required sections with working assessment/sample calls to action.
- [ ] Implement Product, How it works, Open source, Security and privacy, Methodology, Class A guidance, Ancilis services, FAQ, Documentation, Release notes, Privacy, Terms, Disclaimer, Trademark, Contact, and Launch pages.
- [ ] Add reusable vertical content primitives, glossary, accurate boundaries, services copy, contact-only consent, and static fallback.
- [ ] Add unique titles/descriptions, canonical links, Open Graph, sitemap, robots, organization/software/FAQ structured data, and internal-link tests.
- [ ] Verify no invented logos, testimonials, statistics, certifications, affiliations, or keyword-stuffed pages.

## Task 12: Security headers, threat controls, and repository documentation

**Files:** host header configs, `docs/architecture/**`, `docs/security/**`, `docs/deployment/**`, root community/legal files, GitHub templates.

- [ ] Apply CSP, frame, referrer, MIME, permissions, HSTS host examples, and no remote-script policy.
- [ ] Add contact endpoint examples with validation, honeypot, origin checks, body limits, rate limiting, safe logs, and no project fields.
- [ ] Complete architecture, data flow, threat model, rules update, deployment, end-user, maintainer, and release documentation.
- [ ] Add Apache-2.0 LICENSE, NOTICE, README, contribution, conduct, security, governance, trademark, privacy, disclaimer, changelog, roadmap, issue templates, and pull-request template.
- [ ] Configure dependency review/audit, CodeQL, secret scanning guidance, Dependabot, and pinned CI actions.

## Task 13: End-to-end quality gates and release candidate

**Files:** `e2e/**`, `.github/workflows/ci.yml`, link/accessibility configs, screenshot script, release notes.

- [ ] Automate all fifteen critical user steps in one restorable journey and separate destructive-state tests.
- [ ] Intercept every request and fail if filenames, canary document text, answers, project IDs, or evidence metadata leave the application origin.
- [ ] Run offline reload/install tests, Chromium/Firefox/WebKit smoke tests, keyboard traversal, axe scans, print checks, and responsive snapshots.
- [ ] Run `pnpm verify` from a clean dependency install; require typecheck, lint, unit, registry, schema, migration, security, accessibility, E2E, links, and both production builds to pass.
- [ ] Generate working-product screenshots into `docs/screenshots` and mark sample views visibly fictional.
- [ ] Publish `CHANGELOG.md` and release notes for 1.0.0, record exact build directories, and complete the release checklist.

## Completion evidence

- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] `pnpm verify` exits 0.
- [ ] `apps/website/out` is a complete static marketing/documentation build.
- [ ] `apps/bridge/dist` is an installable offline PWA.
- [ ] The registry manifest records the 2026 catalog verification date and every schema checksum.
- [ ] The no-network test proves assessment canary data remained local.
- [ ] The Acme Metrics project exports, deletes, imports, and restores with matching canonical JSON.
- [ ] All release acceptance statements in the user brief are checked in `docs/release/RELEASE_CHECKLIST.md`.
