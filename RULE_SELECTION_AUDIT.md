# Rule Selection Audit

## Purpose

`RULE_SELECTIONS` is an Ancilis workflow-selection structure. Its bucket names
are not themselves official FedRAMP force or applicability. The release data
model now keeps the official aggregate selection, individual rule force, product
inclusion reason, and workflow category separate.

## Required normalized dimensions

Each selected rule exposes independently:

1. effective official Class A statement;
2. effective official force;
3. official Class A applicability/source path;
4. product inclusion reason;
5. Ancilis workflow category/priority;
6. intentional mismatch rationale and review status.

## Audit result

- 62 unique selected records are present across provider, external-framework, mandatory, recommended, optional, package, and marketplace workflows.
- All 23 officially mandatory Class A identifiers are present and match the
  pinned `FRC-CLA-MFR` aggregate exactly.
- Recommended and optional product buckets match the pinned `FRC-CLA-RFR` and
  `FRC-CLA-OFR` aggregates exactly.
- Individual rule force remains distinct from aggregate force; a missing
  individual force is not replaced with an editorial priority.
- The one detected source-layer mismatch is the official `FRC-CLA-RFR`
  reference to `CPO-CSF-CPM`, whose individual rule has no Class A branch. The
  product intentionally preserves that upstream discrepancy and requires human
  confirmation.
- No qualified human review is recorded. All 62 audit rows retain
  `QUALIFIED_HUMAN_REVIEW_PENDING`, `reviewer: null`, and `reviewDate: null`.

## Release gate

The generated JSON/Markdown audit fails when a selected rule lacks traceable
source data, an official mandatory record is omitted or demoted, an optional
record is presented as officially mandatory, a Class A force is ignored, or
official text falls back to a title. An intentional mismatch is accepted only
when the complete pinned `FRC-CLA-RFR` → `CPO-CSF-CPM` fingerprint matches; the
rule identifier alone is not an allowlist. Reviewer and review-date fields remain
blank until a qualified human completes the review.
