# Contributing to Class A Bridge

Thank you for improving a tool used with sensitive security and compliance information. Changes must preserve the product boundary: preparation assistance, careful uncertainty, local processing, and provider-controlled representations.

## Before contributing

Read the [Code of Conduct](CODE_OF_CONDUCT.md), [governance model](GOVERNANCE.md), [security policy](SECURITY.md), [architecture](docs/architecture/ARCHITECTURE.md), and [content guidance](docs/guides/CONTENT_AND_ACCESSIBILITY.md). Never include real customer reports, evidence, credentials, personal information, or confidential incident details in an issue, fixture, commit, screenshot, or test log.

Security vulnerabilities belong in the private reporting process, not a public issue.

## Set up

```sh
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
pnpm verify
```

Node.js 24 and pnpm 10.33.0 are pinned by the repository. Do not regenerate the lockfile with a different package-manager version.

## Change workflow

1. Open an issue for a material product, architecture, regulatory, privacy, or security change.
2. Keep the change focused. Avoid unrelated formatting or dependency churn.
3. Add a failing test before implementation for new behavior and bug fixes.
4. Update user, maintainer, threat-model, or release documentation when behavior or a trust boundary changes.
5. Run `pnpm verify`. Run the relevant accessibility and browser suites for user-interface changes.
6. Complete every applicable item in the pull-request template and identify known limitations.

Commits should be clear and imperative, for example `fix: reject undeclared bundle entries`. Signed commits are welcome but are not required by this governance model.

## Regulatory content changes

Do not edit normalized product content to “fix” an official rule silently.

1. Run `pnpm rules:compare` without approval.
2. Read the source diff and verify the official source, version, dates, and applicability.
3. Update vendored bytes only after human review using the documented approval flag.
4. Recalculate and verify manifests and checksums.
5. Review every Ancilis explanation, question, evidence example, mapping, test, sample record, and output affected by the change.
6. Record interpretation decisions and unresolved official inconsistencies explicitly.
7. Add a changelog entry and obtain review from a compliance-content maintainer.

Schema changes follow the same source/authenticity review. Vendored official files should normally have `localChanges: "none"`. See [docs/guides/RULES_AND_SCHEMAS.md](docs/guides/RULES_AND_SCHEMAS.md).

Run `pnpm schemas:compare` to compare the official schema index and current bytes with the pinned manifest. The command reports added, removed, and byte-changed files and never modifies product content.

## Security-sensitive changes

Two reviews are required for changes to project import/export, PDF processing, cryptography, sanitization, storage, generated documents, Content Security Policy, dependencies that execute on project content, or the contact boundary. Include negative tests and resource limits. Do not log project values to make a failing test easier to debug.

Dependency additions require a written need, browser/runtime impact, license check, provenance review, lockfile diff review, and audit result. Remote runtime code, remote fonts, assessment analytics, and dynamic code execution are outside the 1.0 security model.

## Accessibility and content

User-facing changes must support keyboard operation, visible focus, semantic labels/headings, meaningful errors, screen-reader announcements where state changes, text-labeled statuses, 200% zoom, reduced motion, and sufficient contrast. Acronyms are expanded on first use. Avoid readiness percentages and approval language.

## Licensing

Unless marked “Not a Contribution,” contributions intentionally submitted for inclusion are accepted under Apache License 2.0. Contributors must have the right to submit their work. Do not copy proprietary audit content, customer documents, paid standards, or third-party assets without compatible permission and attribution.
