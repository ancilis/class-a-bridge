# Customer Value Release Implementation Plan

**Goal:** Deliver a verifiable 0.10.0 public-beta release candidate that produces an actionable starting plan with current rule provenance, without overstating human validation.

**Architecture:** Keep the browser-only application and portable project model. Derive typed starting actions from assessment findings; share the same action model between the result screen and report. Preserve historical project and snapshot provenance when the regulatory catalog changes.

**Tech stack:** Existing TypeScript, React, Zod, Vitest, Playwright, static build and archive tooling.

## Approved scope

The user approved implementation of the preceding product review recommendations. The release keeps human content/package review, moderated usability, hardware accessibility and production deployment as explicit external gates. No new remote processing, accounts, analytics, or submission behavior.

## Tasks

- [x] Establish a clean isolated baseline using Node 24 and the frozen lockfile.
- [x] Pin and compare official rules and schemas; add regression tests for the November mandatory/recommended sets, then update catalog, checksums, guidance, generated audits and current documentation.
- [x] Add backward-compatibility tests for July projects. Preserve original catalog provenance and snapshots; make catalog reconciliation explicit and invalidate affected conclusions without deleting user work.
- [x] Add eligibility regressions for carve-outs without uncertainty, distinct adverse answers, and alternative-framework starting points. Implement finding-specific actions with owner, evidence, completion condition and destination.
- [x] Add report tests for full question labels, current/project catalog versions, actionable tasks and safe output. Implement the shared starting plan and a direct result-page export with optional organization/offering names.
- [x] Add UI tests for empty and partially reviewed reuse inventories. Separate unknown assessment coverage from confirmed gaps and offer an actionable empty state.
- [x] Add a guided next task and backup reminder while retaining existing advanced workspace access and reduced-motion/accessibility behavior.
- [x] Run focused tests after each change, then full format/lint/types/unit/build/link/regulatory/schema checks and browser privacy/accessibility/customer journeys.
- [x] Version the candidate, generate sample outputs and distributable archives, record exact fresh evidence and remaining human/deployment gates, and verify extracted-source reproducibility.
- [x] Review the final diff and produce a reviewable release commit and handoff. Do not invent qualified signoff or a live deployment.

## Acceptance checks

1. A carve-out-only assessment has no irrelevant uncertain-answer action.
2. No SOC 2 Type II is described as outside this tool's SOC 2 path, not universal FedRAMP ineligibility.
3. Every starting task names a responsible role, evidence to collect, and a completion condition.
4. The first result exports that same plan without navigating to Reports.
5. An empty reuse inventory says not assessed, never zero assessed gaps.
6. New projects use the verified current catalog; old backups remain readable with truthful provenance and explicit review requirements.
7. No report, schema pass, or UI completion implies certification or qualified content approval.
8. Release evidence distinguishes fresh automation, local UI checks, and pending external validation.

## Execution evidence

Implemented in the isolated 0.10.0 branch. Fresh full verification: 363 unit/component tests, 24 release-tooling tests, and 22 browser executions. All 62 current selected rules pass integrity checks. The patched dependency audit has zero high/critical findings. The extracted source archive passed a frozen install and full verification in an independent Git-less tree. Final source-commit and artifact checksums are recorded by release assembly; final reproduction and artifact scans are retained under dist/release-evidence. External human and deployment gates remain pending as documented in reports/release/0.10.0-RELEASE_EVIDENCE.md.
