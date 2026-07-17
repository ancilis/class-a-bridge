# `@class-a-bridge/documents`

Browser-safe document and package generation for Class A Bridge. Every API is a pure transform over a validated `BridgeProject`; this package does not read storage, make network requests, or upload files.

## Main APIs

- `generateHumanReport` creates the nine release reports plus internal package reports as standalone, print-safe HTML.
- `generateEditableDocx` creates a minimal Office Open XML document for reports that need editing.
- `generateCsv` creates action, evidence, requirement, and mapping tables with spreadsheet-formula escaping.
- `createOfficialDocuments` creates Certification Package Overview, Security Decision Record, and Ongoing Certification Report drafts and validates them against the pinned schemas.
- `createFinalReviewChecklist` reports freshness, broken references, placeholders, missing approvals, and JSON validation results.
- `generatePreparationPackage` creates the numbered preparation ZIP, source manifest, checksums, human-readable reports, JSON, CSV, and optional user-approved attachments.
- `createAdvisorHandoff` and `generateAdvisorHandoffPackage` use an allowlist; source files, excerpts, evidence details, narratives, hashes, and private notes are excluded by default.

## PDF approach

HTML reports include accessible semantic structure, restrictive standalone Content Security Policy, print styles, page-break controls, and `@page` rules. A user opens the file, chooses **Print**, and selects **Save as PDF**. This keeps generation local and lets the user review page breaks and sensitive content before sharing.

## Attachment boundary

Neither package generator reads attachments from storage. Callers must pass selected bytes explicitly, the attachment identifier must already be referenced by the project, and every selection must carry `userApproved: true`. Original SOC 2 reports and evidence attachments are otherwise excluded and recorded in the manifest exclusions.

## Official package fields

Some official-schema fields do not yet exist in the base project model. The caller supplies those through `OfficialDocumentOptions`, including provider contacts, logo URL, package URI, Ongoing Certification Report dates, and explicitly classified third-party resources. Missing values remain missing and produce field-linked validation issues; the generator does not invent provider representations or infer third-party certification status.
