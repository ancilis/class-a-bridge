# Official rules and schema maintenance

## Release 1.0.0 baseline

The rule registry pins FedRAMP Consolidated Rules for 2026:

- catalog version: `2026.07.14.01`;
- official commit: `12fe1b60f578ab448c26d143baac99d16d8bfe14`;
- verified: 2026-07-17;
- SHA-256: `135707003f0aaa5ceb10d7d32c2681e5b1585a4eaf4403d0d135837787e5ae8e`;
- source: <https://github.com/FedRAMP/rules/blob/12fe1b60f578ab448c26d143baac99d16d8bfe14/fedramp-consolidated-rules.json>.

The source bytes are in `packages/rules/vendor/fedramp-consolidated-rules.json`. `packages/rules/src/catalog.ts` selects application prerequisites, external-framework rules, all 23 mandatory Class A records, package dependencies, marketplace application records, and applicable recommended/optional records. Ancilis guidance lives in separate records and includes an explicit preparation-only disclaimer.

The catalog currently contains an inconsistency: `FRC-CLA-RFR` references `CPO-CSF-CPM`, while the latter's 2026-07-14 change removed Class A applicability. The registry preserves the official content and marks it “Needs FedRAMP confirmation.” Maintainers must not resolve it by silently editing official bytes or presenting an invented interpretation.

## Vendored official schemas

All were retrieved 2026-07-17 from `https://www.fedramp.gov/schemas/<file>` and have `localChanges: "none"`.

| Schema                                      | Version | SHA-256                                                            |
| ------------------------------------------- | ------- | ------------------------------------------------------------------ |
| accepted vulnerability info                 | 0.1.0   | `ef470c82b3c8b1be7b90a3003d1358ae90291549f1730cb5794701b5b746c920` |
| advisor information                         | 0.1.1   | `1ad4fc91e1dc1c4a1d47e5cb27bb48939e1310ebfbfd9fe7eedc5eb1587eb8e7` |
| assessor information                        | 0.1.1   | `3e4ff0924d901b2703d395ed9e00858383ddeb209b698d90da96de150af3818c` |
| certification package overview              | 0.1.2   | `279274e9c9d9ba733dcf55bbe6e63dcf227aab2343724fc007586c0fbdcb2616` |
| common definitions                          | 0.1.1   | `6c0547589b394562daef73af08ef7de096750fc851e4daa574d746fb70ce4a10` |
| historical validation/verification activity | 0.1.0   | `4043d034be10e67ce938d4a07bd5bef316ee21f58823ae76e641f71acd70f102` |
| incident report                             | 0.1.1   | `54f41b44823d4e2f456110e03ed53691fe139f9a3157142be651dbb0f801ffb8` |
| ongoing certification report                | 0.1.1   | `06285ed1742176b277f494f00b541c0b3980c9763fd5a3574a7e29e2748f709f` |
| security decision record                    | 1.0.0   | `e076b042abb3a0b244651c562c88b709113a058dd27dca316d1c514ae1a24a2b` |
| significant change notifications            | 0.1.1   | `8b9c61894cd80f7192b41b74d47ff5a84938eae064021922e56342fa043b2838` |
| vulnerability detail report                 | 0.1.0   | `b5107d34bad1cd5a77e522284ede86cd04dbe6f9f319cad33f26653772bf2585` |

Filenames, `$id`, byte sizes, URLs, and checksums are machine-readable in `packages/schemas/src/manifest.ts` and exported by the package index. A dated filename is not treated as immutable; checksum is authoritative for the reviewed bytes.

## Rule comparison procedure

Run the non-mutating comparison first:

```sh
pnpm rules:compare
```

The command prints pinned/candidate sources, current/candidate SHA-256, candidate version/date, and changed top-level sections. A byte difference exits with review-required status and does not write the vendor file.

Then:

1. authenticate the candidate as an official source;
2. archive source URL/commit/retrieval date and calculate SHA-256;
3. review additions/removals, normative level, applicability, dates, relationships, controls, packages, and conflicts;
4. identify affected guidance, questions, evidence examples, owners, scope concerns, output/schema mappings, sample data, tests, website guidance, and disclaimers;
5. record questions that need FedRAMP confirmation rather than inventing an answer;
6. obtain regulatory-content review; and
7. only then apply candidate bytes:

```sh
pnpm rules:compare -- --approve
```

After application, update `CATALOG_MANIFEST`, guidance, reconciliation/required-rule tests, fixtures, release notes, and verification date. Re-run the full test/build. The approval flag means “apply these reviewed candidate bytes,” not “all product interpretation is approved.”

## Schema update procedure

Start with the non-mutating official comparison:

```sh
pnpm schemas:compare
```

It retrieves the official schemas index, hashes the dated files, and reports added, removed, and byte-changed schemas against the pinned manifest. It never changes vendored content; any difference exits with review-required status.

Then:

1. Retrieve every applicable schema through an official HTTPS source into a temporary location.
2. Record source URL, retrieval date, `$id`, `$schemaVersion`, byte size, and SHA-256.
3. Compare bytes and schema structure; review references, required/enum/type/format/pattern changes and document mappings.
4. Vendor official bytes unchanged. If a local change is unavoidable, do not label it official; store it separately with a precise rationale and review.
5. Update the manifest and generate standalone validators:

```sh
pnpm --filter @class-a-bridge/schemas generate
pnpm schemas:verify
```

6. Add valid/invalid fixtures, friendly error/route tests, generator reproducibility evidence, and package-generation tests.
7. Review CSP to confirm no runtime dynamic code generation or schema fetch was introduced.
8. Update changelog/release notes and obtain regulatory plus security review.

## Source display requirements

Every product rule displays identifier, official title/text, level/applicability, source/version/effective and verification dates, change history, and an official link separately from Ancilis explanation. Outputs include a rule/schema version manifest. A provider must be able to identify which baseline produced a conclusion.
