export type OfficialDocumentName =
  | "accepted-vulnerability-info"
  | "advisor-information"
  | "assessor-information"
  | "certification-package-overview"
  | "common-definitions"
  | "historical-ver-activity"
  | "incident-report"
  | "ongoing-certification-report"
  | "security-decision-record"
  | "significant-change-notifications"
  | "vulnerability-detail-report";

export interface SchemaManifestEntry {
  readonly name: OfficialDocumentName;
  readonly file: string;
  readonly url: string;
  readonly id: string;
  readonly schemaVersion: string;
  readonly retrievedAt: "2026-11-06";
  readonly sha256: string;
  readonly bytes: number;
  readonly localChanges: "none";
}

const manifest = (
  name: OfficialDocumentName,
  file: string,
  schemaVersion: string,
  sha256: string,
  bytes: number,
): SchemaManifestEntry => ({
  name,
  file,
  url: `https://www.fedramp.gov/schemas/${file}`,
  id: `https://fedramp.gov/schemas/${file}`,
  schemaVersion,
  retrievedAt: "2026-11-06",
  sha256,
  bytes,
  localChanges: "none",
});

export const SCHEMA_MANIFEST: readonly SchemaManifestEntry[] = [
  manifest(
    "accepted-vulnerability-info",
    "fedramp-accepted-vulnerability-info-schema-2026-06-24.json",
    "0.1.1",
    "2c17ba6e21abd1951e29cf59d90e69d39468c01eb1ad69a6c690233e196f68e2",
    1271,
  ),
  manifest(
    "advisor-information",
    "fedramp-advisor-information-schema-2026-06-24.json",
    "2.0.0",
    "c9ba938e6d1567e98e6c8b4aa784039b0574c39a66d0b1323f51b7df03ce14ea",
    2145,
  ),
  manifest(
    "assessor-information",
    "fedramp-assessor-information-schema-2026-06-24.json",
    "2.0.0",
    "b353bddd70a83d7b4bda4d770b43ce2a3b4d6e812da36c46b9d71fe36aec3420",
    2734,
  ),
  manifest(
    "certification-package-overview",
    "fedramp-certification-package-overview-schema-2026-06-24.json",
    "0.2.0",
    "3870303570bf608dc723cf338cbc3b2295ebd79475003c63699876ac0b89262d",
    11249,
  ),
  manifest(
    "common-definitions",
    "fedramp-common-definitions-schema-2026-06-24.json",
    "0.4.2",
    "19dd37691779171f745ab887444f3604287006af78d261ad76c0cf2dd718e16d",
    6729,
  ),
  manifest(
    "historical-ver-activity",
    "fedramp-historical-ver-activity-schema-2026-06-24.json",
    "0.1.1",
    "51011860138687f25b858b840eefe2b077f31a183ba5d625c461ac296c58df9f",
    1442,
  ),
  manifest(
    "incident-report",
    "fedramp-incident-report-schema-2026-06-24.json",
    "0.2.1",
    "e0871781b6a99c395b8b4854d10ca11e7600ce81c4f3dc6404caddb8ef3105e8",
    4868,
  ),
  manifest(
    "ongoing-certification-report",
    "fedramp-ongoing-certification-report-schema-2026-06-24.json",
    "0.2.1",
    "c67f4e79a107f106abc2dce50043e798f9708e80a5df2c52e41ed700a3a542c8",
    3817,
  ),
  manifest(
    "security-decision-record",
    "fedramp-security-decision-record-schema-2026-06-24.json",
    "1.1.1",
    "6a6d7dca1a9ae0031c06df6213bf5c5631e9b9b5fb81c050403cfd723484be86",
    8146,
  ),
  manifest(
    "significant-change-notifications",
    "fedramp-significant-change-notifications-schema-2026-06-24.json",
    "0.1.3",
    "e0f624b7996c2d8dfb1891c4663fb1df2ec6487a65f03fb43f1ce6ed59910372",
    3516,
  ),
  manifest(
    "vulnerability-detail-report",
    "fedramp-vulnerability-detail-report-schema-2026-06-24.json",
    "0.1.1",
    "92b2918106c0117ba84d14a5da33762dbb5df2acbf5303a806f6d4bbea98f60b",
    1219,
  ),
];
