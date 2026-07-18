# Changelog

All notable project changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use semantic versioning for software compatibility. Regulatory catalog and schema versions are recorded independently because they can change without matching application versions.

## [0.9.0] — 2026-07-18

Public beta. Version 1.0.0 remains gated on qualified human review of the mandatory
SOC 2 mapping playbooks and generated package, plus completed real-hardware browser verification.

### Added

- Local-first browser assessment with no account or backend dependency.
- Eight-question preliminary Class A fit assessment with reasons, uncertainty, source rules, and three actions.
- Deterministic local SOC 2 PDF metadata extraction with user confirmation and manual fallback.
- Guided eligibility, scope, SOC 2 materials, Class A requirements, seven Key Security Indicator workflows, evidence, action-plan, package, reports, and project-settings workspaces.
- Structured SOC 2 control inventory with manual entry, local extraction suggestions,
  CSV import/export, deterministic playbook-based reuse candidates, and human-confirmed
  many-to-many mapping records.
- SOC 2 Reuse and Gap Report with mapping provenance, scope and period conflicts,
  exceptions, carve-outs, missing evidence, and requirements without confirmed support.
- Standard, password-protected, and redacted project export; import, migration, integrity checks, and local deletion.
- Human-readable reports, official-schema JSON validation, package scaffolding, and immutable internal-review snapshots.
- Fictional Acme Metrics demonstration workspace and watermarked outputs.
- Static marketing, guidance, service, legal, and documentation website.
- Optional isolated contact-only handler with validation, origin checks, body limits, honeypot handling, throttling interface, safe logs, and HTTPS webhook delivery.
- WCAG 2.2 AA-oriented component and workflow coverage, security tests, browser tests, and CI quality gates.
- Source-archive verification that reports failed child-command output and rejects
  provenance inherited from an unrelated parent Git repository.
- Attachment ownership checks and coordinated cleanup that preserve shared bytes,
  reject metadata-only cross-project collisions, and remove legacy IndexedDB files.

### Regulatory baseline

- FedRAMP Consolidated Rules for 2026 catalog `2026.07.14.01`, commit `12fe1b60f578ab448c26d143baac99d16d8bfe14`, verified 2026-07-17.
- Eleven official JSON Schema files whose filenames are dated 2026-06-24, vendored without local changes and recorded with individual versions and SHA-256 checksums.
- The official `FRC-CLA-RFR` / `CPO-CSF-CPM` Class A applicability inconsistency is preserved and flagged “Needs FedRAMP confirmation”; no silent reinterpretation is made.
- Effective Class A fields resolve from `varies_by_class.a` when present, with field-level
  source paths and a generated integrity report. Individual rule force, the official
  Class A aggregate obligation, and product workflow inclusion remain separate.

### Security and privacy

- No assessment analytics, remote document parser, remote artificial-intelligence service, remote error reporter, or third-party runtime script in the private workspace.
- Strict project schemas, migration validation, archive limits, safe paths, hashes, browser-native cryptography, output escaping, CSV formula protection, and deployment headers.

### Public-beta limitations

- The 62 Ancilis SOC 2 mapping playbooks are versioned drafts and have not been
  represented as qualified-human approved.
- Real-hardware Safari/PWA restart validation and substantive human review of the
  generated package remain open 1.0.0 gates.
- Version 0.9.0 does not include optical character recognition; image-only and protected reports use manual entry or CSV import.
- It does not integrate cloud infrastructure, provide collaborative server synchronization, automate submission, or implement Class B/Class C workflows.
- Browser storage can be evicted and does not replace deliberate backups.
- In-memory contact throttling is appropriate for one process; horizontally scaled deployments must provide a shared rate-limit store.
