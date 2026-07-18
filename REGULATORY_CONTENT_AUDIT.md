# Regulatory Content Audit

## Baseline

- Catalog: `2026.07.14.01`
- Upstream commit: `12fe1b60f578ab448c26d143baac99d16d8bfe14`
- Vendored SHA-256: `135707003f0aaa5ceb10d7d32c2681e5b1585a4eaf4403d0d135837787e5ae8e`
- Verified date recorded by the product: 2026-07-17
- Selected records: 62; Ancilis mandatory bucket: 23

## Corrected normalization blocker

The baseline normalizer read only top-level `force` and `statement`. The release
candidate now resolves `varies_by_class.a` first, preserves top-level content as
context, and records a source path for every effective field.

The regression suite covers the baseline consequences:

- selected Class A branches no longer resolve to `UNSPECIFIED` when a nested
  Class A force exists;
- selected rules no longer substitute a title for available requirement text;
- every selected rule with `varies_by_class.a` is checked table-by-table; and
- explicit regressions cover `IEC-CSO-FIR` and `IVV-CSX-AIA`.

## Integrity constraints

The implementation preserves the complete official object and records the source
path for each effective field. It does not alter official bytes or silently
resolve the `FRC-CLA-RFR` → `CPO-CSF-CPM` inconsistency. The exception is a strict
source fingerprint: any additional missing statement provenance, force
provenance, aggregate force, official object path, or other integrity defect
fails verification. Official text, normalized Class A text, Ancilis guidance,
and user content remain separate.

## Human review status

No evidence in the repository demonstrates qualified approval of the generated
`RULE_GUIDANCE` records or the rule-selection interpretation. Mapping playbooks
remain `Draft`, and every rule-selection audit row records
`QUALIFIED_HUMAN_REVIEW_PENDING` with a null reviewer and review date. This blocks
a 1.0 designation but not an accurately labeled public beta.
