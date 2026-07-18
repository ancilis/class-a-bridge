# Source Release Reproducibility

## Reproduced baseline failure

On 2026-07-18, the source archive from baseline `e490a3c` was extracted to a temporary directory with no `.git` directory. Under Node `24.18.0` and pnpm `10.33.0`:

- `pnpm install --frozen-lockfile`: passed;
- `TURBO_FORCE=true pnpm build`: passed, 9/9 tasks executed;
- `pnpm release:assemble`: failed.

The failure is `scripts/assemble-release.mjs` invoking `git -C <archive> archive ... HEAD` unconditionally. Git returned status 128: `fatal: not a git repository`.

## Required behavior

Release assembly will use explicit environment provenance, embedded `SOURCE_PROVENANCE.json`, embedded release metadata, Git when available, then a truthful unavailable value. A Git-less archive build must warn, mark `builtFromArchive`, use an existing reviewed source archive or create a deterministic filesystem archive, and continue without inventing a commit.

## Verification target

`pnpm verify:source-archive` creates and extracts a source archive without `.git`,
performs a frozen install, forces verification and build, assembles the combined
distribution, inspects the result, and proves no `git init` occurred.

## Implemented release behavior

Release assembly now creates a real gzip-compressed tar archive directly from the source tree while excluding Git metadata, dependency directories, build output, test output, caches, source maps, and environment files. The archive contains generated provenance that matches the bytes being packaged. The combined distribution records the final archive SHA-256 in:

- `release-manifest.json`;
- `SOURCE_PROVENANCE.json`; and
- `checksums.txt`.

Source-commit resolution is field-based and ordered: `CLASS_A_BRIDGE_SOURCE_COMMIT`, embedded `SOURCE_PROVENANCE.json`, the root package release record, Git metadata, then an explicit unavailable value. `CLASS_A_BRIDGE_VERSION`, `CLASS_A_BRIDGE_RELEASE_CHANNEL`, and `CLASS_A_BRIDGE_SOURCE_ARCHIVE_CREATED_AT` provide reproducible release overrides. Missing Git metadata emits a warning, sets `builtFromArchive: true`, and never fabricates a commit. A dirty Git tree also emits a warning because the archive contains working-tree bytes that are not fully identified by the recorded commit.

The heavyweight verification command writes its machine-readable result to `dist/release-evidence/source-archive-verification.json`. A pass requires the extracted archive to have no `.git` directory, frozen installation to succeed, `pnpm verify` to pass inside the extracted tree, and the nested source archive checksum to match the assembled manifest.

## Verification result — 2026-07-18

An independent extracted-tree run passed without Git metadata:

- the extracted tree contained no `.git` directory;
- frozen-lockfile dependency installation passed;
- workspace verification and the production build passed;
- release assembly passed from the extracted tree; and
- no `git init` workaround was used.

This establishes that the corrected release process does not require Git metadata.
The top-level `pnpm verify:source-archive` wrapper also passed for the release
candidate in 63.4 seconds and wrote
`dist/release-evidence/source-archive-verification.json`. The wrapper confirmed a
frozen install, full repository verification, release assembly, no Git metadata,
and no `git init`. The final release-commit replay and final public archive
checksums remain mechanical publication steps.

## Release interpretation

- Baseline defect reproduction: **Passed**.
- Corrected Git-less extracted-tree build and assembly: **Passed independently**.
- Truthful provenance fallback: **Passed by focused release-script regression
  tests**.
- Top-level wrapper for the release candidate: **Passed in 63.4 seconds**.
- Final top-level wrapper at the final release commit: **Pending**.
- Final source archive and SHA-256 checksum: **Pending**.
