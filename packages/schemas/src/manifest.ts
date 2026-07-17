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
  readonly retrievedAt: "2026-07-17";
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
  retrievedAt: "2026-07-17",
  sha256,
  bytes,
  localChanges: "none",
});

export const SCHEMA_MANIFEST: readonly SchemaManifestEntry[] = [
  manifest(
    "accepted-vulnerability-info",
    "fedramp-accepted-vulnerability-info-schema-2026-06-24.json",
    "0.1.0",
    "ef470c82b3c8b1be7b90a3003d1358ae90291549f1730cb5794701b5b746c920",
    1268,
  ),
  manifest(
    "advisor-information",
    "fedramp-advisor-information-schema-2026-06-24.json",
    "0.1.1",
    "1ad4fc91e1dc1c4a1d47e5cb27bb48939e1310ebfbfd9fe7eedc5eb1587eb8e7",
    1626,
  ),
  manifest(
    "assessor-information",
    "fedramp-assessor-information-schema-2026-06-24.json",
    "0.1.1",
    "3e4ff0924d901b2703d395ed9e00858383ddeb209b698d90da96de150af3818c",
    1666,
  ),
  manifest(
    "certification-package-overview",
    "fedramp-certification-package-overview-schema-2026-06-24.json",
    "0.1.2",
    "279274e9c9d9ba733dcf55bbe6e63dcf227aab2343724fc007586c0fbdcb2616",
    10257,
  ),
  manifest(
    "common-definitions",
    "fedramp-common-definitions-schema-2026-06-24.json",
    "0.1.1",
    "6c0547589b394562daef73af08ef7de096750fc851e4daa574d746fb70ce4a10",
    5489,
  ),
  manifest(
    "historical-ver-activity",
    "fedramp-historical-ver-activity-schema-2026-06-24.json",
    "0.1.0",
    "4043d034be10e67ce938d4a07bd5bef316ee21f58823ae76e641f71acd70f102",
    1439,
  ),
  manifest(
    "incident-report",
    "fedramp-incident-report-schema-2026-06-24.json",
    "0.1.1",
    "54f41b44823d4e2f456110e03ed53691fe139f9a3157142be651dbb0f801ffb8",
    4643,
  ),
  manifest(
    "ongoing-certification-report",
    "fedramp-ongoing-certification-report-schema-2026-06-24.json",
    "0.1.1",
    "06285ed1742176b277f494f00b541c0b3980c9763fd5a3574a7e29e2748f709f",
    3674,
  ),
  manifest(
    "security-decision-record",
    "fedramp-security-decision-record-schema-2026-06-24.json",
    "1.0.0",
    "e076b042abb3a0b244651c562c88b709113a058dd27dca316d1c514ae1a24a2b",
    7483,
  ),
  manifest(
    "significant-change-notifications",
    "fedramp-significant-change-notifications-schema-2026-06-24.json",
    "0.1.1",
    "8b9c61894cd80f7192b41b74d47ff5a84938eae064021922e56342fa043b2838",
    3515,
  ),
  manifest(
    "vulnerability-detail-report",
    "fedramp-vulnerability-detail-report-schema-2026-06-24.json",
    "0.1.0",
    "b5107d34bad1cd5a77e522284ede86cd04dbe6f9f319cad33f26653772bf2585",
    1216,
  ),
];
