# Threat model

**System:** Class A Bridge 1.0.0  
**Review date:** 2026-07-17  
**Method:** asset/trust-boundary review with STRIDE-style threat enumeration  
**Scope:** repository build, static website, private browser PWA, local files/storage/exports, optional contact endpoint, and documented hosting

This model is a security design record, not a FedRAMP assessment or authorization.

## Security objectives

1. Project content does not leave the browser during normal assessment use.
2. Untrusted files, imports, and user text are processed as data and cannot execute code.
3. A malformed input cannot replace a valid active project or cause unbounded resource use within documented limits.
4. Exports include only declared/user-selected content and protect integrity; password-protected exports also protect confidentiality against offline access subject to password strength.
5. Official regulatory content and executable dependencies have reviewable provenance.
6. The optional contact service cannot become an assessment upload endpoint or disclose contact content through logs/errors.
7. A compromised public website is isolated from bridge-origin storage in the recommended deployment.

## Assets

- SOC 2 reports, bridge letters, exceptions, control/test results, and extracted text;
- scope, architecture descriptions, federal-data flows, vendors, identities, and security tooling;
- requirement narratives, evidence metadata/attachments, incidents, vulnerabilities, approvals, and open items;
- project backups, generated reports/packages, passwords, and cryptographic keys in memory;
- contact names, addresses, roles, messages, and approved summaries;
- regulatory catalog/schema provenance and generated validators;
- source, lockfile, CI credentials, release artifacts, service worker, and deployment configuration;
- user trust in preparation findings and clear uncertainty.

## Actors and assumptions

| Actor                            | Capability                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Authorized user                  | Can read/edit/export/delete the project and select local files                                    |
| Local unauthorized person        | May access an unlocked device or shared browser profile                                           |
| Malicious document/import author | Controls PDF, project bundle, metadata, filenames, compressed structure, and project strings      |
| Web attacker                     | Controls another origin and may induce navigation/submission or probe the public contact endpoint |
| Malicious/compromised dependency | Can execute with app/build privileges if admitted to the bundle or toolchain                      |
| Hosting/CDN attacker             | May alter static assets/headers or observe ordinary request metadata                              |
| Browser extension/malware        | May have privileges outside the web application's defensive boundary                              |
| Maintainer/release actor         | Can change rules, guidance, dependencies, source, CI, and release outputs                         |

The app cannot protect data from a fully compromised operating system, browser, privileged extension, malicious browser binary, unlocked profile, or intentionally shared unencrypted export. HTTPS and trusted static hosting are assumed. Users verify human and regulatory representations.

## Rating

Inherent likelihood and impact are rated Low/Medium/High before controls. Residual risk reflects the 1.0 controls. High-residual items block release; Medium items require documented operator/user behavior and regression tests.

## Threat register

| ID  | Threat and impact                                                                                         | Inherent                                    | Controls and verification                                                                                                                                                                       | Residual |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| T01 | A sensitive PDF is uploaded through an application or analytics request                                   | H/H                                         | Bridge has no upload/API client; no analytics; parser receives local bytes; CSP; network-canary browser test; separate contact origin/schema                                                    | L        |
| T02 | PDF active content, embedded URLs, JavaScript, forms, or parser behavior executes or fetches remotely     | M/H                                         | File/size/signature checks; PDF scripting and external fetch disabled; worker same-origin; bytes/text only; candidate text escaped; malformed/encrypted/image-only fallback; malicious fixtures | M        |
| T03 | A parser vulnerability compromises the origin                                                             | M/H                                         | Pinned dependency/lockfile; minimal parser surface; no active content; CSP; dependency review/CodeQL/audit; prompt patching; dedicated bridge origin reduces blast radius                       | M        |
| T04 | Extracted text creates cross-site scripting or generated-report injection                                 | H/H                                         | React text rendering; no dangerous HTML; centralized HTML escaping; strict CSP without dynamic evaluation; generated-content security tests                                                     | L        |
| T05 | User/project strings create formulas when CSV opens in a spreadsheet                                      | H/M                                         | Formula-prefix detection after whitespace/control characters; apostrophe prefix; RFC-style quoting; malicious CSV tests; user warning for external editors                                      | L        |
| T06 | Malicious names traverse paths or create executable/confusing downloads                                   | H/M                                         | Leaf-only Unicode-normalized safe filename; control/reserved character removal; fixed package directories; extension chosen by generator; filename tests                                        | L        |
| T07 | ZIP import uses `../`, absolute, backslash, NUL, empty/dot, duplicate, or undeclared paths                | H/H                                         | Validate every archive and manifest path; reject duplicates/undeclared entries; no filesystem extraction; path tests                                                                            | L        |
| T08 | ZIP bomb, excessive entry count, oversized file, deep path, or high compression ratio exhausts memory/CPU | H/H                                         | 200-entry, 25 MiB single-file, 100 MiB expanded-total, ratio and safe-path limits checked during decode; encrypted-envelope cap; negative fixtures                                              | M        |
| T09 | Invalid/unknown project fields or a malicious migration corrupts/replaces active state                    | H/H                                         | Strict Zod at import/storage boundaries; supported-version check; migrate/validate in memory before write; manifest/project identity; migration tests; active state unchanged on error          | L        |
| T10 | Archive content is altered or attachments are substituted                                                 | M/H                                         | SHA-256 per manifest entry; byte length and declared-file verification; AES-GCM authentication for encrypted envelope; integrity/tamper tests                                                   | L        |
| T11 | Weak password or offline guessing reveals a protected backup                                              | H/H                                         | Minimum 12 characters; PBKDF2-HMAC-SHA-256 310,000 default iterations; random 128-bit salt; AES-256-GCM; no stored password/key; user guidance                                                  | M        |
| T12 | Browser storage is read by another person, same-origin script, extension, or device malware               | H/H                                         | Recommended dedicated origin; no third-party script; CSP; device/shared-browser warning; explicit deletion; password-protected portable backup. IndexedDB is not described as encrypted         | M        |
| T13 | Storage eviction, private mode, quota, or failed IndexedDB causes silent loss                             | M/H                                         | Visible backend/save time; fallback disclosure; export backup; import recovery; storage contract/failure tests; no false server-backup claim                                                    | M        |
| T14 | One project or origin accesses another project's attachments accidentally                                 | M/H                                         | Project/attachment identifiers and adapter boundaries; explicit references; delete-all ownership prefix; contract and restore equality tests                                                    | L        |
| T15 | Service worker caches project responses, third-party resources, or a poisoned old bundle                  | M/H                                         | Static-shell caching only; no project request route/background sync/cross-origin cache; release asset/version review; offline/update tests; clear-site recovery guidance                        | M        |
| T16 | Public website third-party script reads bridge data                                                       | L/H on separate origins; H/H on same origin | Recommended separate origins; bridge has no third-party script; website has no analytics by default; host CSP; same-origin cohosting warning                                                    | L/M      |
| T17 | Dependency or package-install compromise injects exfiltration                                             | M/H                                         | Exact lockfile; frozen install; minimal dependencies; Dependabot, dependency review, audit, CodeQL, provenance/license review; no remote runtime scripts; reproducible build verification       | M        |
| T18 | Maintainer silently changes official rules or Ancilis interpretations                                     | M/H                                         | Commit-pinned bytes/hash/version/date; compare defaults to no write; explicit approval flag; official/guidance separation; tests; two-domain review; changelog                                  | L        |
| T19 | Official schema URL changes while a dated-looking filename stays the same                                 | M/H                                         | Vendor exact bytes; per-file retrieval date/size/SHA-256/`$id`/schema version; local validation; human source review before update                                                              | L        |
| T20 | Dynamic validator generation violates CSP or executes schema-supplied code in the browser                 | M/H                                         | AJV standalone generation at maintainer time; vendored schemas; generated files reviewed/tested; no runtime `eval`/`Function`; strict script CSP                                                | L        |
| T21 | Advisor/package export accidentally includes a report, attachment, excerpt, contact, or sensitive note    | H/H                                         | Attachments opt-in; redacted allowlisted projection; explicit inclusion/review; manifest; tests with canary secrets; UI warning                                                                 | M        |
| T22 | Generated output falsely implies certification, approval, eligibility, or completeness                    | H/H                                         | Controlled vocabulary/disclaimer; user-controlled status/approval; findings show source/certainty/human review; sample watermark; content tests/review                                          | L        |
| T23 | Contact endpoint accepts project JSON, evidence, files, or oversized bodies                               | H/H                                         | Strict seven-key contact schema; unknown-key rejection; no multipart; JSON only; 16 KiB streaming limit; field limits; tests for project/evidence keys                                          | L        |
| T24 | Cross-site request submits/spams the contact endpoint                                                     | H/M                                         | Exact Origin allowlist; CORS preflight; POST/OPTIONS only; honeypot; injectable per-client rate limit; high-level fields; generic responses                                                     | L/M      |
| T25 | Contact logs/errors disclose email, message, approved summary, delivery response, or secret               | H/H                                         | Typed event-only logger; request ID/status/reason allowlist; catch discards exception details; no body/IP logging; no-store responses; redaction tests                                          | L        |
| T26 | Contact webhook is redirected or configured with embedded credentials/insecure transport                  | M/H                                         | HTTPS-only URL; URL credentials rejected; redirects disabled; timeout; bearer token only in header; generic failures; tests                                                                     | L        |
| T27 | In-memory throttling is bypassed across serverless instances/restarts                                     | H/M                                         | Store interface supports shared atomic implementation; docs prohibit memory store for multi-instance use; edge/provider WAF recommended; monitoring without content                             | M        |
| T28 | Contact delivery/retention exceeds user expectation                                                       | M/H                                         | Separate privacy notice; user-entered fields only; approved-summary opt-in; operator retention/deletion/access requirements; no bridge connection                                               | M        |
| T29 | Diagnostics or telemetry captures project/file values                                                     | M/H                                         | No remote error reporting; downloadable diagnostics exclude content/filenames by default; typed codes/capabilities only; canary tests                                                           | L        |
| T30 | Clickjacking or hostile embedding tricks export/delete/contact actions                                    | M/H                                         | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, same-origin dialogs with explicit labels, destructive confirmation, host header tests                                                        | L        |
| T31 | Browser navigation/referrer leaks project content placed in URLs                                          | M/H                                         | Project state never encoded in route query/hash; Referrer-Policy; downloads use object URLs; no value-based analytics/logging                                                                   | L        |
| T32 | Accidental disclosure through downloads, print queues, email, shared drives, screenshots, or clipboard    | H/H                                         | Sensitive export warnings, redacted option, explicit attachment choices, sample watermark, safe filenames, user guide, no automatic sharing                                                     | M        |
| T33 | Accessibility defect causes a user to miss a blocker, uncertainty, destructive action, or privacy choice  | M/H                                         | WCAG 2.2 AA target; semantic errors/status text; focus management; keyboard/axe/zoom/contrast tests; destructive confirmation and live announcements                                            | L/M      |
| T34 | Hosting omits CSP/MIME/frame/HSTS headers or serves mutable/development artifacts                         | M/H                                         | Host-specific checked-in configs; deployment verification commands; immutable releases; release checklist; GitHub Pages limitation disclosed                                                    | M        |

## Abuse cases and control notes

### Malicious PDF

PDF is a complex format and parser compromise retains Medium residual risk. The release uses the smallest needed text-extraction surface, disables scripting/network behavior, limits bytes, and never renders the PDF's active document UI as authoritative. Dedicated-origin deployment and prompt dependency patching are required defense in depth. Optical character recognition is absent in 1.0, avoiding another parser/runtime.

### Browser storage

IndexedDB protects availability and offline use, not confidentiality against local control. Application-level encryption of live browser storage is not claimed; it would require key management and could create misleading protection while the app holds plaintext. Password protection is applied to portable exports where a transfer boundary exists.

### Project imports and archives

Import is a replace-capable operation, so the app validates before state mutation. ZIP entries are never extracted to a filesystem. Every entry must be declared and hashed. Future formats must not relax limits based on archive metadata alone, because compressed sizes and paths are attacker-controlled.

### Content generation

All project strings are untrusted. A serializer owns escaping for its output context. HTML escaping is not reused as JSON/CSV safety; CSV formula defense is applied before quoting. Generated artifacts retain disclaimers and sample watermarks. DOCX/PDF libraries and template changes are dependency/trust-boundary changes.

### Supply chain

The lockfile is a security artifact. Dependency bumps require code/provenance/license review and a frozen clean build. CI action references are pinned to commit SHA. Branch protection, required review, GitHub secret scanning, Dependabot, dependency review, CodeQL, and `pnpm audit` are expected repository controls. A release made outside the documented pipeline is not covered by the same assurance.

### Contact service

The handler's `MemoryRateLimitStore` bounds key count but does not coordinate multiple instances. Production multi-instance deployments must provide a shared atomic store or equivalent provider rate limit. The platform adapter must derive a client key from a trusted address signal, not an arbitrary public header. Operators must not add file upload or project fields to the contact route.

## Privacy/security negative requirements

The 1.0 bridge must not contain:

- assessment analytics, advertising, fingerprinting, beacons, or remote error reporting;
- remote AI/document extraction, remote fonts, tag managers, chat widgets, or third-party runtime scripts;
- dynamic code execution such as `eval`, `new Function`, or runtime AJV generation;
- project content in URL, console, application log, diagnostic default, service-worker cache, or contact request;
- automatic attachment inclusion, assessor sharing, advisor sharing, or submission;
- a claim that browser storage is secure against local device control.

## Release validation

Before release, run the complete commands and procedures in [SECURITY_TESTING.md](SECURITY_TESTING.md), verify host headers against production responses, inspect the built bridge for unexpected remote origins, run the no-project-data browser canary flow, audit dependencies, and complete [the release checklist](../release/RELEASE_CHECKLIST.md). Any High residual finding blocks release.

## Review triggers

Review and update this model when adding an account, backend, synchronization, collaboration, remote parser/AI, analytics, cloud integration, new file/archive format, new document library, runtime schema fetch/generation, service-worker behavior, cross-origin embedding, Class B/C workflow, or contact data field/delivery provider. Regulatory source changes also require provenance review even if no application code changes.
