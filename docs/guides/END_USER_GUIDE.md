# End-user guide

Class A Bridge helps a cloud software company with a System and Organization Controls (SOC) 2 Type II report understand and prepare for FedRAMP 20x Class A. It organizes a record; it does not certify, approve, audit, assess, submit, or guarantee a result.

## Start safely

Open the bridge in a current modern browser on an access-controlled device. No account is required. The persistent message “Private workspace — project data stays in this browser” describes normal product behavior.

Choose one starting path:

1. **Start with my SOC 2 report** reads a local PDF. Confirm, edit, or ignore every extracted candidate.
2. **Start without uploading a report** uses manual entry and is fully supported.
3. **Explore a fictional sample workspace** opens Acme Metrics, marked “Fictional demonstration — not an actual certification package” and “Fictional example — not for submission.”

The report is not uploaded to Ancilis. If it is password-protected, scanned, image-only, malformed, or too large, use manual entry. Class A Bridge does not perform optical character recognition in version 1.0.

## Get the early result

Answer the first eight questions. Each question explains why it matters, a plain-language example, a generally strong answer, who usually knows, whether it can create a blocker, and a “Not sure” option.

The preliminary result can be:

- Likely fit;
- Likely fit with preparation work;
- Needs expert review;
- Potential scope mismatch; or
- Not currently eligible.

Open a finding to see the answers that led to it, applicable rule, deterministic/suggestion label, unresolved human review, and evidence that would resolve uncertainty. A preliminary result is not a FedRAMP determination. Correct an answer at any time; the reasons and actions update.

## Work through the workspace

### Overview

Use the blockers, unresolved decisions, milestone counts, evidence review, validation state, and three recommended actions. Progress is shown as records/milestones, never as a compliance percentage.

### Eligibility

Review the early answers, external-framework/application prerequisites, Marketplace status, and open issues. Confirm report dates and scope before relying on a freshness conclusion.

### Scope

List the offering, environments, hosted components, data stores, identity, logging, deployment, security tooling, endpoints, third parties, and systems that handle federal customer data or affect confidentiality, integrity, or availability. Exclude a component only with a rationale. Ask technical owners to resolve the generated confirmation questions.

### SOC 2 materials

Record the Type II report, bridge/gap letter when needed, audit-engagement material, next-report schedule, and supplemental material. Statuses are Present, Missing, Expiring, Needs confirmation, or Not applicable with rationale.

### Class A requirements

Open a rule for plain-language guidance first, then expand official details. Add implementation, verification, validation, independent review where applicable, mappings, evidence candidates, owner, due date, notes, questions, exceptions, and acceptance.

Only a provider user changes requirement status. A found control identifier or suggested mapping never completes a rule. “Complete for internal review” and “Approved by provider” describe internal record state, not FedRAMP approval.

The seven dedicated Key Security Indicator flows cover logging changes, restricting network traffic, reviewing training, automating account management, adopting passwordless methods, reviewing incident response, and securing information. Use the suggested narrative structure and involve the named technical team.

### Evidence

Add a local file or external reference with title, description, type, source system, owner, collection/relevant dates, expiration/review date, related rules/controls, sensitivity, hash, notes, and review status. A file remains an **evidence candidate** until a qualified reviewer determines relevance and sufficiency.

### Action plan

Work in priority order: eligibility blockers, scope blockers, before application preparation, missing implementation, missing evidence, technical confirmation, executive approval, recommended improvements, and optional enhancements. Assign owner, due date, and status; export CSV/print/executive views when useful.

### Package and reports

Generate reports and package documents from a validated snapshot. JSON validation errors show the affected section, expected/current value, an editable link, and a resolution. Fix the project field and regenerate; do not edit generated JSON as the authoritative record.

The package ZIP excludes original reports and sensitive evidence attachments unless you select them. Review its index, manifest, checksums, rule/schema versions, open items, disclaimer, and approvals.

“Prepare final review” creates an immutable internal snapshot and checks freshness, references, schema validity, placeholders, and approvals. It does not submit an application. The provider submits its own application.

## Back up and restore

Open Project settings to see storage backend, approximate size, last save, exports, deletion, and privacy documentation.

- **Standard export** creates a portable `.classabridge` bundle. Attachments are opt-in.
- **Password-protected export** encrypts the bundle in the browser. Use a unique long password and transfer it through a different channel. The password cannot be recovered.
- **Redacted advisor handoff** removes reports, attachments, excerpts, sensitive notes, contact details, and generated bodies by default. Review before sharing.

Test a backup by importing it in a separate browser profile before relying on it. Import validates integrity and migration before replacing active data. Keep backups in an access-controlled location.

## Delete local data

Delete project removes the selected project. Delete all local data removes Class A Bridge projects and owned attachments from that browser profile. Review the confirmation carefully. Deletion cannot recall downloaded, printed, emailed, or shared copies.

Browser storage can be cleared or evicted by the browser/device. Ancilis has no server copy to restore.

## Request an Ancilis review

“Request an Ancilis Class A readiness review” opens a contact-only form. It does not send project data. You may submit only contact information and optionally type a high-level summary you approve. Do not paste report text, evidence, credentials, or incident detail. A redacted advisor bundle is downloaded separately and is not sent by the button.

## Troubleshooting

| Situation                | Action                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| PDF cannot be read       | Continue with manual entry; confirm file type/size and obtain an accessible copy from its owner |
| Storage fallback shown   | Export frequently; persistent binary attachments require IndexedDB                              |
| Project disappeared      | Check the same browser/profile/origin, then restore a backup; Ancilis has no remote copy        |
| Import rejected          | Keep active state, verify the file/password/version, and do not bypass integrity errors         |
| Validation error unclear | Follow its editable link, expected value, and resolution; review official details if needed     |
| Package has open items   | Assign/resolve them or record the uncertainty; structural output is not approval                |
| Contact form unavailable | Use the displayed email fallback without attachments                                            |

For a suspected security vulnerability, do not send project data; follow [SECURITY.md](../../SECURITY.md).
