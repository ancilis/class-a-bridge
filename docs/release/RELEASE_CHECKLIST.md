# Release checklist

This checklist is completed against the exact release commit and production-like outputs. A checked item means a reviewer observed evidence, not that the source file contained a pre-checked assertion. Store command logs, browser matrices, screenshots, header captures, and generated fixture outputs with the release record.

## Identity and scope

- [ ] Version and tag are `1.0.0`; changelog and release notes match.
- [ ] Product name is “Class A Bridge by Ancilis.”
- [ ] Maintained-by-Ancilis and independent/non-GSA/non-FedRAMP-affiliation disclaimer is visible.
- [ ] No page/output says compliant, certified, approved, guaranteed eligible, guaranteed to pass, or submission-ready from software completion.
- [ ] Class B/Class C, optical character recognition, cloud integrations, collaboration sync, and automated submission remain clearly outside 1.0.
- [ ] Apache-2.0 license, NOTICE attribution, third-party license review, and trademark boundaries are complete.

## Clean build and repository

- [ ] Clean checkout uses Node.js 24 and pnpm 10.33.0.
- [ ] `pnpm install --frozen-lockfile` exits 0.
- [ ] `pnpm format:check` exits 0.
- [ ] `pnpm lint` exits 0 with no unresolved lint error.
- [ ] `pnpm typecheck` exits 0 with no TypeScript error.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm build` exits 0.
- [ ] Accessibility and end-to-end suites exit 0.
- [ ] Link checker exits 0; no broken navigation or placeholder button exists.
- [ ] Dependency audit/review and CodeQL contain no unaccepted release-blocking finding.
- [ ] Secret scan contains no credential; production artifacts contain no development secret/path/source map leak.
- [ ] `apps/website/out` is the complete static website build.
- [ ] `apps/bridge/dist` is the complete installable offline PWA build.
- [ ] `apps/contact-api/dist` is the optional compiled contact handler.
- [ ] `dist/class-a-bridge` contains the website at `/`, bridge at `/app/`, merged headers, and `release-manifest.json`.
- [ ] `/downloads/class-a-bridge-1.0.0-source.tar.gz` matches the reviewed Git `HEAD` and contains no secret/build output.

## First-run and early value

- [ ] A nontechnical compliance user can start without documentation, account, developer tool, terminal, SDK, API key, or cloud connection.
- [ ] First screen has exactly: local SOC 2 PDF, manual start, fictional sample.
- [ ] No login/account wall is present.
- [ ] Privacy indicator says “Private workspace — project data stays in this browser.”
- [ ] A useful preliminary result appears after no more than eight high-value answers.
- [ ] Every question provides why/example/strong-answer/owner/blocker guidance where useful and a “Not sure” choice.
- [ ] Result has classification, summary, reasons, supporting answers, blockers, missing information, next three actions, official references, method/certainty, human review, resolving evidence, and non-determination disclaimer.
- [ ] Revising an answer updates the result and provides an understandable reason.
- [ ] Preliminary HTML and PDF exports are polished and print correctly.

## PDF and SOC 2 materials

- [ ] PDF processing is local with file type/size checks, no active scripting, no remote parser, and no remote AI.
- [ ] Type II, issuer, period/date, service, criteria, controls, subservice/carve-out, exceptions, complementary controls, and bridge references can be proposed when deterministic text supports them.
- [ ] Every candidate shows value, page, snippet, confidence, and confirm/edit/ignore.
- [ ] No extracted value becomes authoritative without user confirmation.
- [ ] Protected, scanned, image-only, malformed, and oversized PDFs have an understandable manual fallback without lost work.
- [ ] Materials checklist supports Present, Missing, Expiring, Needs confirmation, and Not applicable with rationale.

## Application navigation and workflows

- [ ] Ten destinations exist and navigate correctly: Overview, Eligibility, Scope, SOC 2 materials, Class A requirements, Evidence, Action plan, Package, Reports, Project settings.
- [ ] Every dashboard finding has a clear next action/deep link.
- [ ] Scope builder covers environments/components/stores/identity/logging/deployment/security/endpoints/third parties/federal-data/impact/exclusions and produces summary/inventory/data flow/questions/mismatch.
- [ ] Requirement workspace contains all requested narrative, mapping, evidence, owner/date/note/question/exception/acceptance/status/review fields.
- [ ] Status options match the approved controlled vocabulary.
- [ ] No extraction or mapping automatically completes a requirement.
- [ ] Each of the seven mandatory Key Security Indicators has a dedicated guided workflow with outcome, collection, technical team, implementation/verification/validation evidence, weaknesses, narrative structure, and uncertainty.
- [ ] Evidence supports metadata, local file/reference, relationships, SHA-256, sensitivity, freshness, and review state; it is called an “evidence candidate.”
- [ ] Action plan has all nine priority categories, ownership/dates/status/filtering, CSV/print/executive outputs.

## Regulatory registry and schemas

- [ ] Catalog shows version `2026.07.14.01`, commit, official source, and last verified date 2026-07-17.
- [ ] Registry contains all 23 mandatory IDs and applicable prerequisite/external-framework/package/recommended/optional records.
- [ ] Every rule contains official title/text/level/applicability/source/version/effective/verified dates, separate Ancilis guidance, why/questions/evidence/owner/scope/output/schema mappings, change history, and disclaimer.
- [ ] `FRC-CLA-RFR` / `CPO-CSF-CPM` inconsistency is preserved and flagged, not silently interpreted.
- [ ] Rule compare prints readable source/hash/version differences and refuses mutation without explicit human approval.
- [ ] Schema compare reports added/removed/byte-changed official files and never mutates pinned content.
- [ ] All 11 official schema files match recorded source/version/retrieval/bytes/SHA-256 and have no local changes.
- [ ] Standalone browser validators require no network or dynamic code execution.

## Mapping, package, reports, final review

- [ ] Many-to-many mappings cover SOC 2 controls/criteria/pages/tests/results/exceptions, Class A rules, evidence, and narratives.
- [ ] Suggested mappings show reasons and require confirmation; manual mapping works; no universal one-to-one crosswalk claim exists.
- [ ] Package generates the required human/JSON documents, material checklist, mapping/evidence/scope/open-item/index/source-schema/validation/approval/disclaimer/advisor records.
- [ ] JSON validation errors show explanation, section, editable link, expected/current value, and resolution.
- [ ] Official-validator link/instruction is available.
- [ ] Package ZIP uses numbered directories, manifest, and checksums and excludes reports/evidence attachments by default.
- [ ] Final review makes an immutable snapshot with version/approver/dates/freshness/missing references/schema checks/placeholders/approvals/checklist/provider-submission reminder.
- [ ] Reports include preliminary, executive, detailed gap, scope, mandatory requirements, evidence, action, validation, and advisor outputs in applicable HTML/PDF/DOCX/CSV formats.

## Persistence, export, restore, deletion

- [ ] IndexedDB save/load/list/delete/attachment behavior works; fallback is visible and accurate.
- [ ] Data panel shows stored content, approximate size, last save, backup/import/delete, and privacy documentation.
- [ ] Standard export is portable and attachments are opt-in.
- [ ] Password-protected export uses browser Web Crypto, rejects weak/wrong/tampered inputs generically, and round-trips.
- [ ] Redacted advisor handoff excludes reports, attachments, excerpts, contacts, sensitive notes, and generated bodies by default.
- [ ] Import rejects traversal/duplicate/undeclared/oversized/ratio/hash/schema/version/migration/identity attacks before state replacement.
- [ ] Export → delete all → import restores a canonical project and selected attachments exactly.
- [ ] Delete project and delete all local data remove owned records after reload.

## Security and privacy

- [ ] Threat model and data flow match the built release.
- [ ] Host responses contain reviewed CSP, HSTS readiness, MIME/frame/referrer/permissions/opener/resource headers and correct cache/MIME behavior.
- [ ] Bridge contains no assessment analytics, remote AI/parser/error reporting, remote font, third-party script, dynamic code execution, or automatic sharing.
- [ ] Service worker caches static shell only; no project content/background sync/cross-origin cache exists.
- [ ] Full-flow network canaries prove no document/project value leaves the browser in Chromium, Firefox, and WebKit.
- [ ] HTML/CSV/filename/JSON/report content-injection tests pass.
- [ ] Contact handler rejects project/unknown fields, unapproved origins, invalid/oversized bodies; honeypot/throttle/safe logs/HTTPS no-redirect delivery pass.
- [ ] Contact CTA sends nothing before explicit form submit; no project is read; static fallback works.
- [ ] Diagnostic default excludes project values and filenames.

## Accessibility, responsive, print, content

- [ ] Main flow meets WCAG 2.2 AA automated checks.
- [ ] Keyboard-only onboarding, interview, edit, mapping, evidence, generation, export, delete, import, and dialogs work with visible focus/no trap.
- [ ] Semantic headings/landmarks/labels/errors/live regions/dialogs/status text/alternatives are correct.
- [ ] Contrast, reduced motion, 200% zoom, 320 CSS pixel reflow, touch targets, tablet application, mobile website, desktop document workflow, and print are manually verified.
- [ ] No lorem ipsum, fake statistic/testimonial/logo/case study/badge, inaccessible control, unexplained JSON error, or keyword-stuffed page exists.
- [ ] Acronyms expand on first use and plain-language guidance precedes official details.

## Website, services, sample, documentation

- [ ] Exact homepage hero, supporting copy, calls to action, trust line, seven sections, and ten FAQ questions are present and accurate.
- [ ] All requested public pages, legal pages, sitemap, robots, unique metadata, canonical links, structured data, and reusable content system build.
- [ ] Free product does not gate assessment, reports, workspace, exports, package, validation, or sample.
- [ ] Services CTA/message is accurate and never sends project data.
- [ ] Acme Metrics is complete, fictional, mixed-state, and every sample view/output is visibly watermarked.
- [ ] README, contribution/conduct/security/governance/trademark/privacy/disclaimer/changelog/roadmap, architecture, threat/data flow, rules, deployment, end-user, maintainer, templates, and release documentation are present and linked.
- [ ] Working-product screenshots are generated from the exact release build and sample views show the watermark.

## Approval

- [ ] Product/design review completed.
- [ ] Engineering review completed.
- [ ] Security/privacy review completed.
- [ ] Regulatory content review completed.
- [ ] Accessibility/content review completed.
- [ ] Release manager reviewed evidence and approved public release.
