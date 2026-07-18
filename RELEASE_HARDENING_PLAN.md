# Class A Bridge Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use test-driven development and evidence checkpoints.

**Goal:** Preserve the verified local-first product while correcting regulatory classification, adding a deterministic SOC 2 reuse accelerator, fixing source-archive builds, stabilizing tests, and producing an evidence-backed public release.

**Architecture:** Extend the existing rules, project, documents, testing, bridge, and website packages in their current dependency direction. Official source normalization remains in `packages/rules`; deterministic suggestions and persisted review state remain in `packages/project`; reports remain pure transforms in `packages/documents`; the bridge composes these features without a backend.

**Tech stack:** Node.js 24, pnpm 10.33.0, TypeScript, React, Vite, Next.js static export, Zod, Vitest, Playwright, IndexedDB, Web Crypto, AJV standalone validators.

---

## Baseline evidence

- Baseline commit: `e490a3c856073f1fe4b9703f2ffc0c59d43e4601`.
- Fresh install: Node `24.18.0`, pnpm `10.33.0`, `pnpm install --frozen-lockfile` passed on 2026-07-18.
- Untouched bridge suite: 75/75 passed; constrained one-worker grouped run: 75/75 in 23.26 seconds.
- Uncached production build: 9/9 Turbo tasks executed successfully.
- Extracted source archive: install and uncached build passed; `pnpm release:assemble` failed because `scripts/assemble-release.mjs` unconditionally invoked `git archive` without `.git`.
- Regulatory defect: 62 selected rules; 29 resolved `UNSPECIFIED`; 22 fell back to titles. Class-specific branches exist for 22 selected rules, including `IEC-CSO-FIR` and `IVV-CSX-AIA`.

## Task 1: Regulatory normalization and selection integrity

- [ ] Add failing tests for `varies_by_class.a` statement, force, timeframes, artifacts, source paths, original object retention, and title/UNSPECIFIED rejection.
- [ ] Normalize effective Class A fields without altering vendored official bytes.
- [ ] Separate official force/applicability from Ancilis workflow inclusion and priority.
- [ ] Generate machine-readable and Markdown integrity/selection reports.
- [ ] Verify official catalog and schema checksums.

## Task 2: SOC 2 reuse domain model and playbooks

- [ ] Add backward-compatible control inventory and mapping-review fields with schema tests.
- [ ] Add draft Ancilis mapping playbooks for every selected rule and detailed records for Class A path rules.
- [ ] Mark all unreviewed content `Draft`; never fabricate reviewer/date or approval.
- [ ] Implement deterministic, explainable suggestions that cannot complete requirements.
- [ ] Add CSV parsing/export/template safeguards and tests.

## Task 3: SOC 2 reuse workspace and documents

- [ ] Extract SOC 2 materials/reuse UI from `App.tsx` behind existing project/update contracts.
- [ ] Add control inventory, CSV paste/import, suggestion review, scope/period/exception/carve-out checks, and confirmed/rejected outcomes.
- [ ] Add print-friendly SOC 2 Reuse and Gap report plus CSV mapping matrix.
- [ ] Include mapping provenance in package/advisor outputs without unapproved mappings.
- [ ] Expand the fictional Acme Metrics project and preserve its watermark.

## Task 4: Source distribution and release evidence

- [ ] Add failing Git-less assembly test and provenance fallback order.
- [ ] Generate `SOURCE_PROVENANCE.json` truthfully with archive-build status.
- [ ] Add `verify:source-archive`, residue scanning, SBOM, checksums, and CI jobs.
- [ ] Replace local-machine paths in public documentation.
- [ ] Update source-build/deployment/rollback documentation.

## Task 5: Test stability and maintainability

- [ ] Identify the expensive full-App behavior and replace avoidable full-shell tests with focused feature/domain tests.
- [ ] Keep targeted integration coverage for routing, persistence, and finalization.
- [ ] Run 10 affected-file, 5 bridge-suite, and 3 workspace-suite grouped repetitions, including constrained execution.
- [ ] Extract high-risk feature modules without changing routes, persistence, migrations, or exports.

## Task 6: Release verification

- [ ] Force clean formatting, lint, type, tests, build, and assembly without Turbo cache reuse.
- [ ] Run Chromium, Firefox, and WebKit production-build flows, accessibility, privacy canaries, offline/PWA, links, audit, secret, static, license, SBOM, and residue checks.
- [ ] Inspect regulatory reports, sample exports, package ZIP, headers, screenshots, and archives.
- [ ] Complete the evidence-based checklist with exact commit, date, reviewer, method, and artifact.
- [ ] Designate `0.9.0 Public Beta` unless qualified content review, real-hardware QA, and substantive human package review are documented.
