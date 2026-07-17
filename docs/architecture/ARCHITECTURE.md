# Architecture

## Purpose and constraints

Class A Bridge is a local-first preparation application, a static public website, and an optional isolated contact endpoint. The private workspace must deliver its core value without an account, network service, cloud integration, API key, or document upload. Its conclusions are explainable preparation findings, never government or assessor determinations.

The architecture enforces four invariants:

1. Project content is processed and stored in the browser unless a user explicitly downloads or shares an export.
2. Official source text, source metadata, and Ancilis guidance remain distinguishable and versioned.
3. Automated extraction and mapping can suggest work, but cannot approve a representation or complete a requirement.
4. The website/contact system and bridge application are separate trust boundaries.

## Monorepo

The repository uses pnpm workspaces and Turborepo with strict TypeScript.

| Component            | Responsibility                                                                                            | May depend on                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `packages/rules`     | Official rule registry, selection sets, guidance, seven Key Security Indicator flows, comparison tooling  | Static vendor JSON only                                  |
| `packages/schemas`   | Unmodified schemas, provenance manifest, generated standalone validators, friendly issues                 | AJV at maintainer build time; no runtime code generation |
| `packages/project`   | Canonical project schema, eligibility, migrations, persistence, hashing, cryptography, bundles, redaction | Rules, Zod, browser platform APIs, archive library       |
| `packages/documents` | Pure project-to-artifact transforms and safe serializers                                                  | Project, rules, schemas                                  |
| `packages/testing`   | Fictional Acme Metrics fixture and shared test data                                                       | Project, rules                                           |
| `packages/ui`        | Accessible reusable controls and design tokens                                                            | React only                                               |
| `apps/bridge`        | Guided React progressive web application                                                                  | Shared packages; browser APIs                            |
| `apps/website`       | Statically generated public content                                                                       | Shared presentational components only                    |
| `apps/contact-api`   | Optional contact-only validation/delivery boundary                                                        | Web platform APIs; no bridge/project package             |

The contact package intentionally does not depend on `packages/project`, and the bridge does not depend on the contact package. That prevents accidental project serialization into an advisory request.

## Runtime topology

```text
Public origin                       Private workspace origin
┌──────────────────────────┐        ┌────────────────────────────────┐
│ Static marketing website │        │ Static PWA shell               │
│ No project access        │        │ React + browser-only packages  │
└─────────────┬────────────┘        ├────────────────────────────────┤
              │ explicit contact    │ PDF bytes → local parser       │
              │ fields only         │ Project → IndexedDB/fallback   │
              ▼                     │ Project → local generators     │
┌──────────────────────────┐        │ Project ↔ explicit file export │
│ Optional contact handler │        └────────────────────────────────┘
│ Separate deployment      │                     │
│ Strict allowlist/schema  │                     ▼
│ Operator delivery sink   │              User-selected files
└──────────────────────────┘
```

The canonical assembled build places the website at `/` and bridge at `/app/`, with a stricter path-specific bridge policy. Its website code has no project/storage integration and includes no third-party runtime script. A higher-isolation deployment can place the bridge on a distinct origin so a website compromise does not inherit the bridge origin's IndexedDB or service-worker scope. A same-origin operator accepts that larger browser-origin blast radius and must preserve the no-third-party-script rule across both paths.

## Project aggregate and derivation

`BridgeProject` is the portable aggregate root. It contains version metadata, organization/offering, eligibility answers and results, SOC 2 metadata and extraction candidates, scope resources and relationships, assessment materials, requirement work, evidence metadata, mappings, actions, generated-output metadata, approvals, snapshots, and migration history.

All imported or restored data passes strict Zod schemas. Unknown fields are rejected at trust boundaries. Migrations produce a new validated object in memory before replacing current state. Attachments are separate from project JSON and referenced by identifiers and SHA-256 hashes.

Derived assessments and actions are deterministic pure functions. Every finding carries supporting answer identifiers, applicable rule references, method/certainty, unresolved evidence, and human-review instructions. A user's requirement status remains explicit state; extraction and suggested mappings do not set it to complete.

## Local persistence

The primary adapter uses IndexedDB for projects and optional attachment bytes. A metadata-only localStorage adapter is available when IndexedDB cannot be opened. Both adapters expose save, load, list, delete-project, delete-all, attachment, backend-name, last-save, and approximate-size behavior.

Browser storage is availability-oriented, not a confidentiality boundary against someone who controls the device, browser profile, browser extensions, or operating system. The user interface therefore identifies local storage, encourages backups, supports deletion, and does not call locally stored data “encrypted at rest.”

## Portable bundles

The standard `.classabridge` file is a ZIP with strict paths and declared content:

```text
manifest.json
checksums.txt
project/project.json
migration/metadata.json
attachments/                 # only explicit selections
generated/                   # only explicit selections
```

The manifest records format/schema/catalog versions, project identity, migration history, logical identifiers, byte sizes, and SHA-256 hashes. Import rejects unsafe/duplicate paths, undeclared files, too many files, large expanded entries, excessive total size, suspicious compression ratios, invalid manifests, hash differences, unsupported migrations, and project/manifest identity disagreement.

Password protection wraps the complete standard bundle in a versioned envelope using PBKDF2-HMAC-SHA-256 and AES-256-GCM through Web Crypto. Salt and initialization vector are random. Passwords and derived keys are never stored. A redacted advisor projection removes source documents, attachments, excerpts, sensitive notes, contact details, and generated bodies unless the user makes a separate inclusion choice.

## Document and package generation

Document generators receive an already validated project snapshot and have no storage or network access. They produce an intermediate artifact model, then safe HTML, JSON, CSV, PDF/DOCX where supported, or package ZIP output. HTML escapes project strings; CSV protects formula-significant prefixes; filenames are normalized; JSON is validated against precompiled vendored schemas.

A validation issue includes the document, JSON pointer, friendly expectation, current value, application route, and remediation. Final-review mode copies an immutable project/artifact snapshot and records package version, approvals, verification/validation dates, freshness, placeholders, missing references, validation output, and the provider-submission reminder.

## PDF processing

The report is read as a local `File`/`ArrayBuffer`. Type and size checks occur before parsing. The parser is configured without document scripting or remote asset fetches. Deterministic patterns produce untrusted candidates with page, snippet, and confidence; candidates are normalized and rendered as text. Every candidate requires confirm, edit, or ignore. Protected, malformed, scanned, image-only, and unsupported PDFs route to manual entry.

The parser does not interpret evidence sufficiency, infer universal crosswalks, or change a requirement status.

## Progressive web application

The PWA shell and same-origin static assets can be cached for offline use. Project and attachment data are not added to Cache Storage. The service worker has no cross-origin runtime caching and no background sync. Updates replace application assets, not project state. The product remains usable if installation is unavailable.

## Regulatory content supply chain

The repository pins an official catalog commit and schema bytes with source URLs, dates, versions, sizes, and SHA-256 checksums. Standalone validators are generated at maintainer time so the browser does not use dynamic code execution. The comparison command downloads a candidate to a temporary context, prints source/hash/version differences, and exits without changing product content unless a maintainer supplies an approval flag.

Applying bytes is not approval of an interpretation. Guidance, mappings, fixtures, output mappings, tests, manifests, release notes, and known inconsistencies require human review.

## Optional contact boundary

The public form constructs a new allowlisted payload from form state; it cannot import or read the bridge project. The endpoint accepts JSON under 16 KiB from exact configured origins, rejects unknown keys and invalid fields, silently discards a filled honeypot, rate-limits a host-derived client key, emits event-only logs, and calls an injected delivery sink. The bundled HTTPS webhook adapter refuses credentials in URLs, refuses redirects, uses a timeout, and returns generic errors.

The endpoint may accept a manually entered `approvedSummary`; it never accepts attachments, project JSON, report text, evidence collections, answers, or requirement records. Operators own contact retention, access, delivery, and deletion obligations.

## Failure behavior

- Storage failure produces a visible fallback/limitation and preserves in-memory work when possible.
- PDF failure preserves the project and offers manual entry.
- Import failure does not replace the active project.
- Validation failure links to editable fields and does not label the package complete.
- Export failure leaves local state unchanged.
- Contact failure offers a contact fallback and does not retry with project information.
- Network loss does not block a loaded bridge workspace.

## Build and deployment

`pnpm verify` checks formatting, lint, strict types, tests, production builds, and the release assembler. Source app output lives at `apps/website/out` and `apps/bridge/dist`; the optional handler compiles to `apps/contact-api/dist`. The canonical static release is `dist/class-a-bridge`, including `release-manifest.json` and a `/downloads/class-a-bridge-1.0.0-source.tar.gz` archive made from Git `HEAD`. Host headers and deployment guidance are in `docs/deployment`. Security review and the release checklist are required before a public tag.
