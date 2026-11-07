# November regulatory source refresh

Retrieved November 6, 2026 from official FedRAMP sources. This is an engineering comparison of source bytes and executable validation, not qualified approval of provider-specific regulatory interpretations.

## Rules

- Previous catalog: 2026.07.14.01.
- Current catalog: 2026.11.02.01.
- Official commit: 64fa769510416fa75fd00a4689466094265b8083.
- SHA-256: 782faecae3eee4aa2aa9d32cdb0de4c929524f2e41dc1f3d143a94a9ca64c4e3.
- Source: https://github.com/FedRAMP/rules/blob/64fa769510416fa75fd00a4689466094265b8083/fedramp-consolidated-rules.json

FRC-CLA-MFR adds SDR-CSX-KSI. The guidance now asks for measures/objectives, persistent cycles, verification, automation sufficiency and validation for applicable KSIs. FRC-CLA-RFR removes CPO-CSF-CPM, resolving the July aggregate/individual-applicability conflict. All current selected records must pass source, force and applicability integrity checks without that exception.

Other source changes include the initial/ongoing/final incident notification metadata, report applicability wording, Marketplace request wording, logo file requirements, public JSON CORS/content-type clarification, and structured timeframe metadata. Vendored source retains these details verbatim. Product guidance remains Draft; users must review the effective official record and its supporting information.

## Schemas

All eleven filenames remain dated 2026-06-24. Their retrieved bytes changed.

- CPO 0.2.0: contact constraints, advisor structure, certified-service fields, repository condition, phone format and logo reference.
- SDR 1.1.1: metadata, references and descriptions for evidence/KSI representations.
- OCR 0.2.1: incident fields and reference corrections.
- Common definitions 0.4.2: logo/contact definitions, rating and vulnerability disposition changes.
- Advisor and assessor information 2.0.0: identity, required fields, contacts, logo and references.
- Incident report 0.2.1: conditional structure, potential-impact typing and CVE pattern.
- Significant-change notifications 0.1.3, vulnerability detail 0.1.1, accepted vulnerability 0.1.1 and historical activity 0.1.1: current references and version changes.

Exact versions, byte sizes, retrieval dates and checksums are in packages/schemas/src/manifest.ts. Vendored bytes are unchanged. Standalone validators are regenerated locally; no runtime schema retrieval is introduced. Generated CPO/SDR/OCR fixtures are checked against the updated validators, and invalid field fixtures must still produce actionable validation errors.

## Compatibility and review

July project records remain readable. Reconciliation is explicit and preserves historical evidence. A new package cannot be generated until its project baseline is reconciled. No historical snapshot is rewritten or relabeled as reviewed under the new catalog.

Qualified playbook, rule-selection interpretation and substantive generated-package review remain pending.
