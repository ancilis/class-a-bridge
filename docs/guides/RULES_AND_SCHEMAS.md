# Official rules and schema maintenance

## Public Beta 0.10.0 baseline

Catalog 2026.11.02.01, official commit 64fa769510416fa75fd00a4689466094265b8083, verified 2026-11-06.

SHA-256: 782faecae3eee4aa2aa9d32cdb0de4c929524f2e41dc1f3d143a94a9ca64c4e3.

The selected registry contains 62 records, including 24 additional mandatory Class A records. SDR-CSX-KSI is included and the former CPO-CSF-CPM recommended-reference inconsistency is resolved in the official source. Guidance remains Draft pending qualified review. See ../release/2026-11-06-regulatory-delta.md for the engineering comparison.

All eleven schema byte streams were retrieved on 2026-11-06 without local changes. Filenames are not immutable version identifiers.

| File                                                            | Schema version | SHA-256                                                            |
| --------------------------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| fedramp-accepted-vulnerability-info-schema-2026-06-24.json      | 0.1.1          | `2c17ba6e21abd1951e29cf59d90e69d39468c01eb1ad69a6c690233e196f68e2` |
| fedramp-advisor-information-schema-2026-06-24.json              | 2.0.0          | `c9ba938e6d1567e98e6c8b4aa784039b0574c39a66d0b1323f51b7df03ce14ea` |
| fedramp-assessor-information-schema-2026-06-24.json             | 2.0.0          | `b353bddd70a83d7b4bda4d770b43ce2a3b4d6e812da36c46b9d71fe36aec3420` |
| fedramp-certification-package-overview-schema-2026-06-24.json   | 0.2.0          | `3870303570bf608dc723cf338cbc3b2295ebd79475003c63699876ac0b89262d` |
| fedramp-common-definitions-schema-2026-06-24.json               | 0.4.2          | `19dd37691779171f745ab887444f3604287006af78d261ad76c0cf2dd718e16d` |
| fedramp-historical-ver-activity-schema-2026-06-24.json          | 0.1.1          | `51011860138687f25b858b840eefe2b077f31a183ba5d625c461ac296c58df9f` |
| fedramp-incident-report-schema-2026-06-24.json                  | 0.2.1          | `e0871781b6a99c395b8b4854d10ca11e7600ce81c4f3dc6404caddb8ef3105e8` |
| fedramp-ongoing-certification-report-schema-2026-06-24.json     | 0.2.1          | `c67f4e79a107f106abc2dce50043e798f9708e80a5df2c52e41ed700a3a542c8` |
| fedramp-security-decision-record-schema-2026-06-24.json         | 1.1.1          | `6a6d7dca1a9ae0031c06df6213bf5c5631e9b9b5fb81c050403cfd723484be86` |
| fedramp-significant-change-notifications-schema-2026-06-24.json | 0.1.3          | `e0f624b7996c2d8dfb1891c4663fb1df2ec6487a65f03fb43f1ce6ed59910372` |
| fedramp-vulnerability-detail-report-schema-2026-06-24.json      | 0.1.1          | `92b2918106c0117ba84d14a5da33762dbb5df2acbf5303a806f6d4bbea98f60b` |

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
