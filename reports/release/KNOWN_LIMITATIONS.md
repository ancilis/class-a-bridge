# Known limitations — Class A Bridge 0.9.0 Public Beta

Evidence snapshot date: 2026-07-18

## Regulatory and compliance content

- All 62 Ancilis SOC 2 mapping playbooks are versioned Draft records. None has a
  recorded qualified technical, compliance, or claims approval. They remain
  labeled explanatory guidance, not official FedRAMP text.
- Automated regulatory integrity passed for all 62 selected records: 61 PASS, one
  exact documented upstream inconsistency, and zero FAIL. Automated source
  integrity is not a substitute for qualified regulatory review.
- The deterministic mapping engine suggests likely supporting material. It cannot
  interpret every auditor-specific control, scope, procedure, result, exception,
  carve-out, subservice organization, or complementary control.
- A reviewed mapping is supporting material, not a determination that a FedRAMP
  requirement is satisfied. Additional implementation, verification, validation,
  scope evidence, assessor work, and provider approval may remain necessary.
- The pinned official catalog preserves the upstream `FRC-CLA-RFR` reference to
  `CPO-CSF-CPM`. The inconsistency is disclosed and not silently resolved.
- No documented evidence shows that a generated package has undergone
  substantive review through an actual FedRAMP Class A application process.

## Product and workflow limitations

- The central application component remains oversized and is a maintainability
  risk. High-risk feature seams were extracted where needed for testing, but a
  complete feature-module decomposition was not used as a release-gating rewrite.
- The SOC 2 reuse workspace supports review and traceability; richer integrated
  follow-up planning for every mapping (for example, all owner/due-date/action
  combinations) remains an incremental enhancement.
- Image-only, password-protected, malformed, or otherwise unreadable PDFs use
  manual entry or CSV import. Remote optical character recognition and remote
  document processing are intentionally absent.
- Deterministic PDF extraction is fallible; every extracted value remains a
  suggestion requiring confirmation, editing, or rejection.
- Browser storage can be evicted or constrained by browser or operating-system
  quota. Users should create standard or password-protected backups.
- The product has no cloud synchronization, multiuser collaboration, or
  server-side disaster recovery.

## Automated verification completed

- The complete workspace passed 349/349 tests across 46 files.
- Formerly flaky groups passed 120/120 across ten runs; the complete bridge suite
  passed 485/485 across five runs; three forced uncached workspace runs passed
  1,047/1,047; shuffled order passed 97/97.
- The production Playwright matrix passed 21/21. Cross-browser workspace/privacy
  checks passed in Chromium, Firefox, and WebKit.
- The Chromium automated accessibility suite passed 4/4.
- The release scan covered 699 files and four archives with zero active finding.
- The production dependency audit reported zero high or critical findings, and a
  38-component CycloneDX SBOM was generated.
- Independent extracted-tree verification without `.git` metadata passed the
  frozen install, verification, build, and assembly flow.

## Release operations still pending

- The final release commit has not been created, so the final source/deployable
  archive wrapper, archive checksums, and post-assembly scan are not yet stamped.
- Public deployment, HTTPS/header validation, production contact-endpoint
  operation, and rollback execution have not been performed.
- A final hosted static-analysis service result has not been recorded.
- Two declared-license cases identified in `reports/release/license-summary.md`
  still require substantive human review.

## Human validation pending

- Real-hardware Chromium, Firefox, and Safari/WebKit browser, progressive-web-app,
  persistence, and offline-restart testing has not been recorded.
- Manual keyboard, screen-reader, 200% zoom, reflow, reduced-motion, touch/tablet,
  and print verification has not been recorded.
- Moderated usability testing with compliance, engineering, and operator/founder
  participants has not occurred.
- A representative auditor-issued SOC 2 report has not been evaluated under the
  prepared manual release procedure.
- Qualified human review of mapping guidance and substantive package output
  remains required for 1.0.0.

## Product scope

Class B, Class C, native mobile applications, cloud integrations,
infrastructure-as-code remediation, remote artificial intelligence, remote
optical character recognition, universal SOC 2 interpretation, automated
government submission, and a complete trust-center platform are outside this
beta.

Class A Bridge organizes application-preparation records. It does not certify,
authorize, approve, independently assess, provide legal advice, submit an
application, or guarantee eligibility or acceptance.
