# Class A Bridge by Ancilis

Class A Bridge is an open-source, local-first browser workspace that helps a cloud software company turn an existing System and Organization Controls (SOC) 2 Type II report into a clear FedRAMP 20x Class A preparation plan.

It provides a preliminary fit assessment, guided scope and requirement workspaces, a deterministic SOC 2 reuse accelerator with human-confirmed mappings, an evidence library, a prioritized action plan, and human- and machine-readable package scaffolding. It does **not** certify, authorize, approve, audit, independently assess, submit, or guarantee acceptance of a provider.

> Private workspace — project data stays in this browser.

No account, software development kit (SDK), API key, cloud connection, terminal, or document upload to Ancilis is required for the product. The terminal instructions below are only for contributors and self-hosting operators.

## Repository map

| Path                 | Purpose                                                               | Runtime data boundary                             |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| `apps/bridge`        | Static React progressive web application                              | Assessment data remains in the browser            |
| `apps/website`       | Static Next.js marketing, guidance, legal, and documentation site     | Public page requests only                         |
| `apps/contact-api`   | Optional contact-only handler                                         | Explicit contact fields only; deployed separately |
| `packages/ui`        | Accessible shared components and tokens                               | No storage                                        |
| `packages/rules`     | Pinned official catalog plus separate Ancilis guidance                | Public regulatory content                         |
| `packages/schemas`   | Pinned official schemas and generated browser validators              | Public regulatory content                         |
| `packages/project`   | Project model, migrations, local storage, cryptography, import/export | Browser-only project data                         |
| `packages/documents` | Safe local reports and package generation                             | Browser-only project data                         |
| `packages/testing`   | Fictional Acme Metrics fixtures                                       | Fictional data only                               |

Architecture and trust boundaries are described in [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) and [docs/architecture/DATA_FLOW.md](docs/architecture/DATA_FLOW.md).

## Regulatory baseline

The 0.9.0 Public Beta pins FedRAMP Consolidated Rules for 2026 catalog `2026.07.14.01`, commit `12fe1b60f578ab448c26d143baac99d16d8bfe14`, verified 2026-07-17. Eleven official schema files whose filenames are dated 2026-06-24 are vendored without local changes. Exact source URLs, schema versions, checksums, and the human-review update process are documented in [docs/guides/RULES_AND_SCHEMAS.md](docs/guides/RULES_AND_SCHEMAS.md).

Official text and Ancilis guidance are structurally separate. A rule update never silently changes product guidance or a regulatory interpretation.

All 62 SOC 2 mapping playbooks in this beta are labeled **Draft**. They provide transparent, deterministic preparation guidance, but qualified human content review remains a gate for a 1.0.0 release.

## Local development

Prerequisites:

- Node.js 24
- pnpm 10.33.0 (install it directly or use Corepack when Corepack is present)

```sh
# If pnpm is not already installed:
npm install --global pnpm@10.33.0
pnpm install --frozen-lockfile
pnpm dev
```

The website normally starts on `http://localhost:3000`; the bridge app normally starts on `http://localhost:5173`. Both are independent, and the bridge remains useful when the optional contact endpoint is absent.

Useful commands:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify
pnpm rules:compare
pnpm schemas:compare
pnpm schemas:verify
pnpm verify:source-archive
```

`pnpm rules:compare` and `pnpm schemas:compare` are review tools. Schema comparison never mutates pinned files. Rule comparison applies bytes only when a maintainer explicitly supplies its approval flag after reviewing official changes. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Production output

From a clean checkout:

```sh
# If pnpm is not already installed:
npm install --global pnpm@10.33.0
pnpm install --frozen-lockfile
pnpm verify
```

The deployable static outputs are:

- canonical assembled release: `dist/class-a-bridge` (website at `/`, bridge at `/app/`)
- marketing website: `apps/website/out`
- private browser application: `apps/bridge/dist`
- optional compiled contact handler: `apps/contact-api/dist`

Run `pnpm release:samples` to regenerate the public fictional artifacts in
`reports/release/artifacts`: the portable Acme Metrics project, SOC 2 Reuse and Gap HTML/CSV,
schema-validated preparation-package ZIP, license/notice bundle, and checksummed sample manifest.
The command uses `ACME_METRICS_PROJECT`; it does not read local assessment data. Every sample output
is marked “Fictional example — not for submission.”

The canonical release includes `release-manifest.json`, `SOURCE_PROVENANCE.json`, `checksums.txt`, and `/downloads/class-a-bridge-<version>-source.tar.gz`. Release assembly uses explicit release metadata, embedded provenance, package metadata, Git when available, then a truthful unavailable value. It does not require a `.git` directory. `pnpm verify:source-archive` creates and extracts a real source archive, performs a frozen install, runs the complete verification suite, and inspects the Git-less assembled output. The release also merges the website headers with a stricter `/app/*` workspace policy. A deployment may host the website and bridge independently for stronger origin isolation. Apply the supplied security headers in either topology. Deployment instructions for Netlify, Vercel, Cloudflare Pages, object storage/CDNs, Nginx, and GitHub Pages are in [docs/deployment/README.md](docs/deployment/README.md).

## Security and privacy

The bridge has no assessment analytics, remote artificial-intelligence service, third-party document parser, or runtime backend dependency. Files are parsed locally. Project backups are explicit: generated outputs are reviewable selections, while evidence attachments and the original SOC 2 report remain opt-in. Advisor handoffs exclude original reports, attachments, excerpts, and generated bodies by default.

The optional contact handler is isolated and rejects unknown/project fields. Clicking an advisory call to action does not read or transmit a project. Review the [threat model](docs/security/THREAT_MODEL.md), [privacy statement](PRIVACY.md), and [security policy](SECURITY.md) before operating a public deployment.

## Contributing

Contributions are welcome under the [Apache License 2.0](LICENSE). Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [GOVERNANCE.md](GOVERNANCE.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md); do not open a public issue containing exploit or sensitive project data.

## Important boundaries

Class A Bridge is maintained by Ancilis. It is not affiliated with, endorsed by, or certified by the U.S. General Services Administration or FedRAMP. It does not provide certification or legal advice, replace an independent assessor, guarantee acceptance, or submit an application. Providers must review and approve every representation and submit their own materials. See [DISCLAIMER.md](DISCLAIMER.md).
