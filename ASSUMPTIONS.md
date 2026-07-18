# Assumptions

These assumptions make the implementation concrete without changing the product's regulatory interpretation.

1. Repository paths are environment-specific. Public documentation, diagnostics, fixtures, and release artifacts use repository-relative or generic example paths and must not contain a maintainer's local home directory.
2. The official baseline is FedRAMP Consolidated Rules for 2026 catalog `2026.07.14.01`, last updated July 14, 2026, pinned at commit `12fe1b60f578ab448c26d143baac99d16d8bfe14` and verified July 17, 2026.
3. All eleven official FedRAMP JSON Schema files whose filenames are dated June 24, 2026 are vendored without local modifications. Retrieval-date checksums and their individual `$schemaVersion` values remain authoritative because the dated URLs can change.
4. The initial release supports preparation for 20x Class A only. References to other classes are explanatory or service-planning content, not implemented assessment workflows.
5. A useful early eligibility result is based on eight high-value answers. Remaining marketplace, executive, trust-center, and contact prerequisites are collected after that result.
6. PDF extraction is deterministic text extraction only. Optical character recognition is intentionally absent; scanned and protected reports use manual entry.
7. The default maximum file size is 25 MiB per PDF or evidence file. Imports enforce a 100 MiB expanded-project limit and conservative archive limits.
8. IndexedDB is available in most modern browsers. The fallback preserves project metadata and narratives but explains that persistent binary attachments require IndexedDB.
9. Standard backups include attachments only when the user selects them. Advisor exports exclude original reports, source excerpts, and attachments by default.
10. Password-protected exports use PBKDF2-HMAC-SHA-256 and AES-256-GCM through browser-native Web Crypto. Password recovery is impossible by design.
11. PDF and DOCX exports are created locally. Browser print remains an additional path for users who prefer the browser's native PDF output.
12. The marketing contact endpoint is optional. A static email/contact fallback is production behavior when no endpoint is configured.
13. The assessment application contains no analytics or remote error reporting. Marketing analytics are disabled unless an operator deliberately configures a privacy-conscious provider.
14. The Acme Metrics project, report metadata, controls, people, domains, identifiers, and outputs are entirely fictional and watermarked.
15. Ancilis guidance is editorial content and is always visually and structurally separated from official rule text.
16. “Production-ready” means the repository builds, tests, exports, restores, runs offline, and has deployable static output; it does not mean FedRAMP has reviewed or endorsed the software.
17. `FRC-CLA-RFR` currently references `CPO-CSF-CPM` even though the latter's July 14 change removed Class A applicability. The product preserves this official inconsistency and labels it “Needs FedRAMP confirmation.”
18. The FedRAMP name is used descriptively; no FedRAMP logo, badge, or endorsement claim is used. Apache-2.0 applies to Ancilis-authored source code, not automatically to separately attributed official content.
19. Mandatory SOC 2 mapping playbooks have not yet received documented qualified human review. Until that review and real-hardware release verification are recorded, the correct release designation is `0.9.0 Public Beta`, regardless of historical filenames or package versions.
20. Deterministic SOC 2 mapping suggestions are editorial preparation aids. They never complete a requirement, establish evidence sufficiency, or create a provider-approved representation without individual human confirmation and provenance.
