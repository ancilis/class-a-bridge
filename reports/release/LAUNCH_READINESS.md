# Launch-readiness report

Evidence snapshot date: 2026-07-18  
Working-tree base commit: `e490a3c856073f1fe4b9703f2ffc0c59d43e4601`  
Final release commit/checksums: **PENDING**

## Recommendation

- **Release designation:** Class A Bridge 0.9.0 Public Beta
- **Launch decision:** **Ready for public beta**, subject to the mechanical final
  commit, archive/checksum stamping, and release-manager approval
- **Version 1.0.0:** **Not supported by the evidence; blocked**

The beta designation is required because all 62 Ancilis SOC 2 mapping playbooks
remain Draft, no qualified regulatory/playbook approval is recorded, no
substantive human package review is recorded, moderated usability testing has not
run, manual accessibility is pending, and real-hardware browser/PWA verification
is pending.

## Automated release evidence

| Gate                               | Result                                                                             | Evidence                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| Complete workspace                 | 349/349 tests passed across 46 files                                               | `reports/release/TEST_RESULTS.md`                |
| Repeated affected group            | 120/120 passed in ten runs                                                         | `TEST_FLAKE_ANALYSIS.md`                         |
| Repeated bridge suite              | 485/485 passed in five runs                                                        | `TEST_FLAKE_ANALYSIS.md`                         |
| Repeated forced uncached workspace | 1,047/1,047 passed in three runs                                                   | `TEST_FLAKE_ANALYSIS.md`                         |
| Shuffled bridge order              | 97/97 passed                                                                       | `TEST_FLAKE_ANALYSIS.md`                         |
| Production browser E2E             | 21/21 passed                                                                       | `reports/release/BROWSER_TEST_REPORT.md`         |
| Cross-browser/privacy              | Chromium, Firefox, and WebKit passed                                               | `reports/release/PRIVACY_NETWORK_TEST_REPORT.md` |
| Automated accessibility            | 4/4 Chromium checks passed                                                         | `reports/release/ACCESSIBILITY_REPORT.md`        |
| Regulatory integrity               | 62 checked: 61 PASS, 1 exact documented upstream inconsistency, 0 FAIL             | `reports/regulatory/regulatory-integrity.md`     |
| Schema integrity                   | 3/3 manifest checks and 5/5 schema package tests passed                            | `packages/schemas/tests/`                        |
| Release residue/integrity          | 699 files and 4 archives scanned; 0 active findings                                | `reports/release/release-integrity.md`           |
| Dependency audit                   | 0 high or critical findings                                                        | `reports/release/dependency-audit.md`            |
| SBOM                               | CycloneDX 1.5, 38 production components                                            | `reports/release/sbom.cdx.json`                  |
| Git-less extracted source tree     | Top-level wrapper passed frozen install, full verify, build, and assembly in 63.4s | `SOURCE_RELEASE_REPRODUCIBILITY.md`              |

Workspace package results were: bridge 97, project 88, documents 29, rules 19,
website 40, contact 60, schemas 5, testing 8, and UI 3.

## Regulatory decision

- Catalog: `2026.07.14.01`.
- Pinned upstream commit:
  `12fe1b60f578ab448c26d143baac99d16d8bfe14`.
- Catalog SHA-256:
  `135707003f0aaa5ceb10d7d32c2681e5b1585a4eaf4403d0d135837787e5ae8e`.
- Class-specific normalization and selection audit: automated checks passed.
- Known `FRC-CLA-RFR` → `CPO-CSF-CPM` inconsistency: preserved and disclosed.
- Playbooks: 62 Draft, 0 with recorded qualified approval.

Automated source integrity supports public beta. The absence of qualified content
review prevents 1.0.0 and must remain visible to users.

## Mechanical publication steps still required

1. Create the final release commit and record its hash.
2. Run the top-level final source-archive wrapper from that commit.
3. Assemble final source and deployable archives.
4. Re-run the release-integrity scan over the final archives.
5. Publish final SHA-256 checksums and update the evidence records.
6. Obtain release-manager approval for the public-beta artifacts.

The independent extracted-tree no-Git workflow has passed. These remaining steps
stamp the final bytes; they are not represented as already complete.

## Human and operational limitations permitted for public beta

- qualified review and approval of the 62 Draft mapping playbooks;
- substantive review of provider representations and generated package structure;
- moderated testing with compliance, engineering, and operator/founder users;
- real-hardware browser/PWA/persistence/offline verification;
- manual keyboard, screen-reader, zoom, reflow, print, tablet, and representative
  auditor-report review;
- substantive review of two declared-license cases;
- public deployment, HTTPS/header capture, deployed contact operation, and
  rollback drill.

These limitations must remain in release notes and block a 1.0.0 designation.

## Evidence index

- Evidence checklist: `reports/release/RELEASE_CHECKLIST.md`
- Test evidence: `reports/release/TEST_RESULTS.md`
- Regulatory integrity: `reports/regulatory/regulatory-integrity.md`
- Rule selection: `reports/regulatory/rule-selection-audit.md`
- Playbook manifest: `reports/regulatory/soc2-mapping-playbook-manifest.json`
- Source reproducibility: `SOURCE_RELEASE_REPRODUCIBILITY.md`
- Flake analysis: `TEST_FLAKE_ANALYSIS.md`
- Security: `reports/release/SECURITY_VERIFICATION_REPORT.md`
- Privacy: `reports/release/PRIVACY_NETWORK_TEST_REPORT.md`
- Accessibility: `reports/release/ACCESSIBILITY_REPORT.md`
- Browser coverage: `reports/release/BROWSER_TEST_REPORT.md`
- Known limitations: `reports/release/KNOWN_LIMITATIONS.md`
