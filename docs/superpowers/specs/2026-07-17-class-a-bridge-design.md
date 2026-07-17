# Class A Bridge by Ancilis — Product and Technical Design

**Status:** Approved for implementation from the user-provided product brief  
**Date:** 2026-07-17  
**Release target:** 1.0.0

## Product outcome

Class A Bridge is a local-first browser application for cloud software companies that already have a System and Organization Controls (SOC) 2 Type II report and need a clear, careful plan for FedRAMP 20x Class A. It provides an early fit assessment, a guided workspace, a many-to-many SOC 2 mapping model, evidence and action planning, and a versioned package scaffold. It never claims to certify, authorize, approve, audit, independently assess, or submit a provider.

The product must be useful before exhaustive data entry. Eight high-value questions produce a preliminary result with reasons, uncertainty, source rules, and three actions. Every generated conclusion remains inspectable and correctable.

## Chosen architecture

The repository is a pnpm workspace coordinated by Turborepo.

- `apps/website` is a statically exported Next.js marketing, guidance, documentation, and legal site.
- `apps/bridge` is a Vite and React single-page application and installable progressive web app (PWA).
- `apps/contact-api` is an optional, separately deployed, contact-fields-only serverless endpoint.
- `packages/ui` owns design tokens and accessible shared components.
- `packages/rules` owns the dated rule registry, guidance, source metadata, and comparison tooling.
- `packages/schemas` vendors official JSON Schemas and exposes browser-safe AJV validators.
- `packages/project` owns the canonical data model, migrations, persistence, hashing, crypto, bundles, and redaction.
- `packages/documents` generates HTML, JSON, CSV, PDF, DOCX, and ZIP outputs without a server.
- `packages/testing` owns Acme Metrics fixtures and shared test helpers.

The public site and private workspace deploy independently. The application has no runtime backend dependency and no analytics. The optional website contact endpoint is isolated and receives contact fields only.

### Alternatives considered

1. A hosted full-stack React application would simplify accounts and centralized storage but conflicts with no-login, local-only processing, offline use, and the required privacy boundary.
2. A single static SPA for both marketing and application would reduce workspace count but weaken search rendering, content authoring, security isolation, and independent deployment.
3. The selected split site/PWA monorepo keeps brand consistency through shared components while preserving different runtime and privacy needs.

## Core data model

`BridgeProject` is the portable aggregate root. It includes:

- project identity, organization, offering, dates, versions, and disclaimer acknowledgements;
- eligibility answers, derived assessment, rationale inputs, unresolved information, and result history;
- confirmed SOC 2 metadata and unconfirmed deterministic extraction candidates;
- scope resources, relationships, federal-data handling, third parties, exclusions, and confirmation questions;
- external assessment material records;
- requirement work records keyed by versioned rule identifier;
- SOC 2 controls, Trust Services Criteria, tests, results, exceptions, and mapping records;
- evidence metadata and attachment references, with attachments stored separately;
- generated action items, reports, package outputs, validation results, and immutable snapshots;
- approvals, migrations, diagnostic metadata, and local-save metadata.

All state transitions pass a Zod schema. Stored attachments are content-addressed by SHA-256. Requirement status is user-controlled; deterministic extraction and mapping suggestions cannot mark a requirement complete.

## Local storage and portability

IndexedDB is the primary store. A storage adapter presents one API and falls back to localStorage for metadata-only projects when IndexedDB is unavailable. Binary attachments remain optional and produce a clear limitation message if the browser cannot persist them.

The `.classabridge` standard bundle is a ZIP containing a manifest, project JSON, migration metadata, hashes, selected attachments, and generated outputs. The encrypted bundle is a small versioned JSON envelope containing PBKDF2 parameters, random salt, AES-GCM initialization vector, and ciphertext produced by Web Crypto. Passwords are never stored. The redacted advisor bundle excludes source documents, attachments, excerpts, and sensitive notes unless the user selects individual inclusions.

Import limits file count, expanded size, compression ratio, path depth, and filename safety before accepting content. Every imported project is schema-validated and migrated in memory before it replaces active state.

## Guided assessment

The first-run screen provides exactly three paths: local SOC 2 PDF, manual start, and the fictional Acme Metrics sample. PDF.js runs from vendored application assets. Deterministic patterns propose report type, issuer, period, date, system name, criteria, controls, subservice organizations, carve-outs, exceptions, complementary user-entity controls, and bridge references. Each proposal includes page, excerpt, confidence, and confirm/edit/ignore controls. Encrypted, scanned, malformed, oversized, or image-only files produce a manual fallback without losing work.

The preliminary interview asks eight questions: report type, freshness, product alignment, federal-offering differences, carved-out dependencies, exceptions/bridge needs, cloud-service operation, and defined federal-data use. The remaining prerequisite questions appear after the early result. A deterministic evaluator classifies the result and emits typed findings with supporting answer IDs, rule IDs, certainty, unresolved evidence, and action IDs.

## Rule and schema provenance

Release 1.0.0 pins FedRAMP Consolidated Rules for 2026 catalog `2026.07.14.01` at commit `12fe1b60f578ab448c26d143baac99d16d8bfe14`, plus all eleven official schema files whose names are dated 2026-06-24 and whose retrieved bytes are verified on 2026-07-17. Each rule separates untouched official text and source history from Ancilis guidance. Every screen shows the catalog version and last verified date.

The official recommended Class A subset references `CPO-CSF-CPM`, while that rule's July 14 change removed Class A applicability because Class A is 20x. The registry preserves the official reference and exposes a “Needs FedRAMP confirmation” note; it does not silently reinterpret the catalog.

The registry includes application prerequisites, external-framework rules, the complete mandatory Class A set, the Class A subset/package records needed to prepare the Certification Package Overview and Security Decision Record, plus applicable recommended and optional Class A rules. A maintainer command downloads into a temporary directory, calculates checksums, compares normalized content, prints a readable diff, and refuses to update vendored content unless a human supplies an approval flag.

## Application information architecture

The persistent shell contains the required ten destinations and a visible “Private workspace — project data stays in this browser” indicator. Desktop uses a left navigation rail and document workspace; tablet uses a compact rail; small screens use an accessible navigation drawer.

- Overview prioritizes blockers, decisions, milestones, evidence review, validation, and three actions.
- Eligibility shows answers, early result, reasoning, prerequisites, and revision controls.
- Scope uses editable resource cards and simple relationships, not a diagramming prerequisite.
- SOC 2 materials tracks presence, freshness, confirmation, and rationale.
- Class A requirements provides filters, catalog details, work records, and seven focused Key Security Indicator flows.
- Evidence manages local candidates, freshness, hashes, relationships, and review.
- Action plan groups deterministic tasks and supports owner/date/status editing and exports.
- Package builds human and machine-readable artifacts, validates JSON, links errors to fields, and creates snapshots.
- Reports generates polished, watermarked outputs.
- Project settings controls storage, export, import, deletion, privacy, catalog version, and diagnostics.

Every empty, error, and blocked state contains a concrete recovery action. Official identifiers and schema fields are progressive disclosure.

## Package generation

Pure functions transform a validated project snapshot into named artifact models. Separate serializers produce safe HTML, official-schema JSON, CSV, PDF, and DOCX. HTML output escapes project text and applies a restrictive standalone style. CSV fields that begin with formula-significant characters are prefixed safely. Filenames are normalized and collision-resistant.

The package ZIP follows the numbered directory layout in the brief and excludes source evidence by default. A validation issue contains artifact, JSON pointer, friendly field label, editable application route, expected value, current value, and remediation. Final review creates an immutable snapshot with version, approver, verification and validation dates, freshness checks, missing references, unresolved placeholders, approvals, and the provider-submission reminder.

## Website and conversion

The website uses reusable page and content-section data. The exact hero, supporting copy, trust line, product boundaries, privacy claims, services message, FAQ answers, glossary, and requested legal/documentation pages are rendered as static HTML with unique metadata, canonical links, Open Graph data, and relevant schema.org structured data.

The advisory call to action opens a contact-only flow. An optional user-approved summary is visible and editable before submission. No application state is read by the website. Without a configured endpoint the form offers an email fallback and retains no assessment information.

## Security and privacy design

The bridge application permits only same-origin assets and blocks outbound connections with Content Security Policy. It does not register third-party scripts, analytics, remote fonts, remote parsers, or remote artificial-intelligence services. File readers operate on ArrayBuffers, PDF.js scripting is disabled, derived text is normalized, and display output is escaped.

The threat model covers malicious documents, local compromise, shared-browser disclosure, cross-site scripting, dependency compromise, import/ZIP attacks, resource exhaustion, generated-content injection, CSV injection, contact abuse, and accidental export. Security headers, size limits, input schemas, safe archive paths, Web Crypto, hashes, dependency and secret scanning, lockfile pinning, and no-network end-to-end tests are release gates.

Diagnostics contain app version, browser capabilities, error codes, and stack locations but omit project values, filenames, answers, evidence metadata, and document content by default.

## Accessibility and content

Components target Web Content Accessibility Guidelines (WCAG) 2.2 AA: semantic landmarks and headings, named fields, error summaries, live regions, focus restoration, keyboard operation, visible focus, contrast, non-color status labels, reduced motion, 200% zoom, touch targets, and print layouts. Plain language is the default; acronyms expand on first use. No readiness percentage is shown.

## Verification strategy

Vitest covers evaluator, registry, migrations, crypto, bundles, sanitizers, schema mapping, parser patterns, generation, and freshness. React Testing Library covers accessible interaction. Playwright covers the fifteen required user steps, keyboard flow, axe scans, offline reload, import recovery, and zero project-data requests. Cross-browser smoke tests target Chromium, Firefox, and WebKit. CI runs formatting, lint, typecheck, unit tests, schema/rule integrity, production builds, accessibility, browser tests, links, dependency audit, and secret scanning.

## Deployment

Both apps build to static directories. Deployment examples cover GitHub Pages, Netlify, Vercel static output, Cloudflare Pages, and generic object storage/CDN. All hosts receive equivalent CSP and security headers. The bridge can be mounted at its own origin or a dedicated path, with the manifest and service-worker scope generated accordingly.

## Release boundary

Version 1.0.0 supports Class A preparation only. It does not perform optical character recognition, cloud integration, automated submission, assessor services, collaborative server sync, or automated regulatory interpretation. Manual workflows and deterministic parsing remain fully functional without optional services.
