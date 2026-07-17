# Governance

Class A Bridge is an Ancilis-maintained open-source project. Maintainers steward the product, security model, regulatory provenance, releases, and community process in the public interest of safe preparation workflows.

## Roles

- **Users** use or evaluate the software and may report problems or propose improvements.
- **Contributors** submit issues, documentation, tests, code, design, or regulatory research.
- **Maintainers** review and merge changes, manage releases and dependencies, triage security reports, and enforce community standards.
- **Regulatory content reviewers** are maintainers designated to review official-source updates and the separation of official text from Ancilis guidance.
- **Security reviewers** are maintainers designated to review trust-boundary, cryptography, parser, import/export, dependency, and deployment changes.

Roles are based on sustained, constructive participation and demonstrated judgment. Ancilis appoints and removes maintainers. The current repository host's protected-branch and review configuration is the authoritative roster of people with merge authority.

## Decisions

Routine changes are decided in pull-request review. Material decisions—data flows, remote services, regulatory interpretation, licensing, compatibility, security posture, deprecation, or governance—require a written issue or architecture decision record and explicit maintainer approval.

Maintainers seek rough consensus, grounded in user safety, current official sources, tests, accessibility, maintainability, and the project mission. When consensus cannot be reached, Ancilis makes and records the decision. Commercial service interests do not justify weakening the free product or hiding limitations.

## Required review

- Regulatory catalog, schema, applicability, and guidance changes require a regulatory content reviewer.
- Storage, PDF, archive, cryptography, sanitization, Content Security Policy, contact, or dependency trust-boundary changes require a security reviewer.
- User-facing workflow and content changes require accessibility and content review.
- A release requires the completed release checklist and a maintainer who did not author every material change.

No maintainer may approve a change that silently converts a suggestion into an official determination, sends assessment data remotely by default, or implies government approval.

## Conflicts of interest

Reviewers disclose financial, employment, advisory, or personal interests that could reasonably affect a decision. A conflicted maintainer should not be the sole approver. Security and conduct reports involving a maintainer are reviewed by an unconflicted maintainer.

## Changes to governance

Governance changes use the same public proposal and review process as other material decisions. Security-sensitive details and personal information may remain private.
