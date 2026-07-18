# Release integrity and supply-chain evidence

Class A Bridge uses one tested, dependency-free Node.js tool to inspect public source and distribution files and to generate production dependency evidence.

## Commands

- `pnpm test:release-integrity` runs the scanner and report-generator regression suite.
- `pnpm release:scan` scans source, generated distribution directories, source archives, deployable ZIP files, and unencrypted `.classabridge` sample bundles when present.
- `pnpm release:supply-chain` queries pnpm for production dependency licenses and vulnerability advisories, then writes the CycloneDX software bill of materials and human-readable reports.
- `pnpm release:integrity` runs the supply-chain report generator followed by the release scan. It exits unsuccessfully for an active scan finding, missing or unknown license metadata, or a high or critical dependency advisory.

The supply-chain command needs access to pnpm's configured advisory registry. For an evidence-preserving offline rerun, pass reviewed JSON captures with `--license-input` and `--audit-input`; the command never writes those input locations to its reports.

## Generated evidence

The default output directory is `reports/release/`:

- `release-integrity.json` and `release-integrity.md`
- `sbom.cdx.json` using CycloneDX 1.5
- `license-summary.json` and `license-summary.md`
- `dependency-audit.json` and `dependency-audit.md`

Reports contain repository-relative locations only. Secret-like matched content is replaced by a SHA-256 finding fingerprint. The SBOM strips pnpm's installation paths.

## Scan policy

The scan fails on:

- macOS, Linux, or Windows workstation-profile paths
- the known development username, represented in scanner code only by a one-way digest
- JavaScript source maps in source or distributable output
- recognizable cloud, package-registry, source-control, or private-key credentials
- archive traversal paths, unsafe compression behavior, oversized entries, or an archive that cannot be inspected

Dependency directories, version-control metadata, coverage output, test reports, framework caches, and intermediate Next.js build files are excluded. Public `dist` directories and archives are not excluded.

## Reviewed exceptions

`release-integrity-allowlist.json` supports only exact exceptions. Each record must identify one rule, one repository-relative path, and the scanner's exact finding fingerprint. It must also include a substantive justification, reviewer, review date, and optional expiry date.

Globs, parent traversal, absolute paths, expired records, missing reviewers, and duplicate exceptions are rejected. A changed file path or matched value produces a new fingerprint and fails closed until it is reviewed again.

The current allowlist records PDF.js/Emscripten's fixed browser-sandbox identity in two compiled worker copies. Those entries are exact, time-limited, and do not suppress any other workstation-profile finding.

## License interpretation

The automated license gate blocks missing, unknown, unlicensed, and no-assertion metadata. Copyleft and Creative Commons dependencies are listed as substantive review items; the generator does not represent them as legally approved. License counsel or the repository owner must resolve those items before making a final legal distribution decision.

The SBOM inventories the production dependency set installed for the release platform. Optional native packages can differ across operating systems, so release evidence should be generated on the same platform used to assemble the published artifact.
