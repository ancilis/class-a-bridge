# Data flow and inventory

## Trust boundaries

```text
                   no project access
       ┌───────────────────────────────────┐
       │ Public website                    │
       │ static content + contact form     │
       └───────────────┬───────────────────┘
                       │ deliberate contact fields
                       ▼
       ┌───────────────────────────────────┐
       │ Optional contact service          │
       │ validate → throttle → deliver     │
       └───────────────────────────────────┘

User/device boundary
┌────────────────────────────────────────────────────────────┐
│ Browser origin: private bridge                             │
│                                                            │
│ Local PDF ──► parser ──► untrusted candidates ──► confirm   │
│                                              │              │
│ Manual answers/resources/evidence metadata ──┤              │
│                                              ▼              │
│                               validated BridgeProject       │
│                                  │      │       │           │
│                                  ▼      ▼       ▼           │
│                             IndexedDB  reports  package     │
│                                  │              │           │
│                                  └──── explicit export ─────┼──► file
└────────────────────────────────────────────────────────────┘
```

There is no automatic edge from the bridge boundary to the website, contact endpoint, Ancilis, an assessor, an analytics system, or an artificial-intelligence service.

## Data inventory

| Data                                  | Sensitivity                               | Default location                                          | Network behavior                | Deletion                                                  |
| ------------------------------------- | ----------------------------------------- | --------------------------------------------------------- | ------------------------------- | --------------------------------------------------------- |
| Public rule/schema content            | Public                                    | App bundle/browser cache                                  | Static asset load/update only   | Clear site data or update app                             |
| Organization/offering and answers     | Confidential                              | Memory + browser project store                            | Never sent by the bridge        | Delete project/all local data                             |
| SOC 2 PDF and extracted text          | Highly confidential                       | File memory; optional selected attachment storage         | Never sent by the bridge        | Release file reference/delete attachment/project/all data |
| Scope, controls, exceptions, mappings | Highly confidential                       | Browser project store                                     | Never sent by the bridge        | Delete project/all local data                             |
| Evidence metadata/attachments         | Highly confidential                       | Project store/separate attachment store                   | Never sent by the bridge        | Delete item/project/all data                              |
| Generated reports/package             | Highly confidential                       | Memory and user-selected download; metadata may be stored | Browser download only           | Delete local output/project and external copies           |
| Password-protected backup             | Highly confidential ciphertext            | User-selected download                                    | Only if user later transfers it | Delete external file; password is unrecoverable           |
| Diagnostic report                     | Operational; content-excluding by default | Memory/download                                           | Only if user later transfers it | Delete external file                                      |
| Website request logs                  | Operational/personal                      | Deployment operator                                       | Ordinary HTTPS request          | Operator retention process                                |
| Contact fields/approved summary       | Personal/business confidential            | Optional endpoint and delivery recipient                  | Only on explicit form submit    | Operator deletion process                                 |

## Flow 1: first load and offline update

1. The browser downloads static HTML, scripts, styles, icons, service worker, public rules, and public schema validators from the bridge origin.
2. The service worker caches application shell assets only.
3. No project exists until the user starts or opens the fictional sample.
4. A later app update refreshes static assets. It does not upload, migrate, or delete project data silently; a project migration occurs locally on open/import.

Controls: HTTPS, immutable release assets, Content Security Policy, no remote script/font dependencies, no cross-origin runtime cache, dependency/release review.

## Flow 2: local SOC 2 report

1. The user chooses a local PDF.
2. The app checks declared type, file signature where practical, and size.
3. PDF bytes are passed to the local parser with active scripting and remote fetch disabled.
4. Page text is normalized into extraction candidates.
5. The UI shows value, source page, a short text snippet, confidence, and confirm/edit/ignore.
6. Only a user's confirmed/edited value becomes report metadata. The original file becomes a persistent attachment only through an explicit selection.

Failure flows: protected, malformed, image-only, scanned, or oversized files produce a plain-language explanation and manual entry. No parser failure is sent remotely.

## Flow 3: guided work and local save

1. The user enters answers, scope resources, relationships, controls, mappings, requirement narratives, evidence metadata, actions, and approvals.
2. Inputs are represented as data, never code, and pass project schemas.
3. Deterministic evaluators generate explainable findings/actions; they do not approve requirements.
4. The storage adapter saves a project record in IndexedDB. If unavailable, it uses the documented metadata-only localStorage fallback.
5. Optional attachments are stored separately and referenced by hash/identifier.

The privacy indicator, save state, storage panel, export, and deletion controls keep this flow visible to the user.

## Flow 4: generation and validation

1. A validated project snapshot is passed to pure document functions.
2. Project strings are escaped/encoded for the target format.
3. JSON outputs are validated against precompiled local official schemas.
4. Issues point back to an editable route. Failure does not alter source project fields or completion status.
5. The user explicitly downloads individual reports or a package ZIP.
6. A generated package record stores its hash and validation state. IndexedDB-capable storage retains the exact ZIP under the output identifier; the metadata-only fallback retains the record and tells the user to preserve the downloaded ZIP.

Original evidence and the source SOC 2 report are excluded from a package unless the user selects files for inclusion.

## Flow 5: project backup and restore

1. The user chooses standard or password-protected export, reviews generated outputs selected by default, and makes any opt-in attachment selections.
2. The app verifies selected output and attachment bytes against their project-record hashes, then creates declared archive paths, a manifest, migration metadata, and checksums.
3. Password protection, when chosen, encrypts the complete bundle locally with Web Crypto.
4. The browser downloads the file.
5. On import, the app limits and validates the envelope/archive, verifies every declared hash, migrates and validates a temporary project, then asks/acts to replace active state.

Invalid imports do not partially write attachments, generated outputs, or replace the current project. Restore stages both byte classes transactionally, rejects identifier collisions, removes superseded owned bytes, and rolls back on failure.

## Flow 6: redacted advisor handoff

1. The app creates an allowlisted projection, not a denylist-only copy.
2. Source report metadata/content, attachments, excerpts, detailed notes, contacts, and generated bodies are removed by default.
3. The user reviews the visible inclusion list and downloads the bundle.
4. Clicking “Request an Ancilis Class A readiness review” alone does not transmit this file.
5. Any later secure sharing occurs outside the bridge through a separate user-controlled intake.

## Flow 7: optional contact

1. The website form contains name, work email, company, role, high-level message, honeypot, and an optional manually typed approved summary.
2. Client code constructs a new contact payload; it has no bridge origin/storage access.
3. The optional endpoint checks exact origin, method, media type, byte limit, JSON shape, lengths, email, controls, honeypot, and rate limit.
4. The endpoint emits logs containing event, request identifier, safe reason code, and HTTP status only.
5. An operator-provided delivery sink sends the validated record to an operator-controlled system.

No report, attachment, evidence object, answer map, requirement record, project identifier, or browser-storage value is an accepted API field.

## Network invariant test

End-to-end tests place unique canaries in a fictional PDF name/content, project name, answer, evidence title, narrative, and project identifier. The browser test observes requests during onboarding, save, evidence, generation, export, deletion, and restore. It fails if a canary appears in a URL, header, request body, WebSocket, beacon, or unexpected destination. Static same-origin asset requests are allowlisted by path and method; assessment data is never allowlisted.

See [docs/security/SECURITY_TESTING.md](../security/SECURITY_TESTING.md) for the manual and automated release procedure.
