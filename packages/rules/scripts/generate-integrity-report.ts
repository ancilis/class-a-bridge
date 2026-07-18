import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertRegulatoryIntegrity,
  CATALOG_MANIFEST,
  REGULATORY_INTEGRITY_REPORT,
  RULE_SELECTION_AUDIT,
  SOC2_MAPPING_PLAYBOOKS,
  SOC2_PLAYBOOK_MANIFEST,
} from "../src/index";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const vendorPath = resolve(packageRoot, "vendor/fedramp-consolidated-rules.json");
const outputRoot = resolve(
  process.env.CLASS_A_BRIDGE_REGULATORY_REPORT_DIR ?? resolve(repositoryRoot, "reports/regulatory"),
);

const markdownCell = (value: unknown) => {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);
  return text.replaceAll("|", "\\|").replaceAll("\n", "<br>");
};

const table = (headers: readonly string[], rows: readonly (readonly unknown[])[]) =>
  [
    `| ${headers.map(markdownCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`),
  ].join("\n");

const vendorBytes = await readFile(vendorPath);
const actualChecksum = createHash("sha256").update(vendorBytes).digest("hex");
if (actualChecksum !== CATALOG_MANIFEST.sha256) {
  throw new Error(
    `Vendored rules checksum mismatch: expected ${CATALOG_MANIFEST.sha256}, received ${actualChecksum}`,
  );
}
assertRegulatoryIntegrity();

await mkdir(outputRoot, { recursive: true });

const integrityJson = {
  generatedAt: new Date().toISOString(),
  catalog: CATALOG_MANIFEST,
  vendoredChecksum: actualChecksum,
  rows: REGULATORY_INTEGRITY_REPORT,
};
const selectionJson = {
  generatedAt: integrityJson.generatedAt,
  catalogVersion: CATALOG_MANIFEST.catalogVersion,
  reviewSummary: {
    status: "QUALIFIED_HUMAN_REVIEW_PENDING",
    reviewer: null,
    reviewDate: null,
    note: "Automated source-to-selection checks passed. No qualified human regulatory review is recorded by this generated report.",
  },
  rows: RULE_SELECTION_AUDIT,
};
const playbookJson = {
  generatedAt: integrityJson.generatedAt,
  ...SOC2_PLAYBOOK_MANIFEST,
  records: SOC2_MAPPING_PLAYBOOKS.map(
    ({ ruleId, contentVersion, contentReviewStatus, reviewer, reviewDate }) => ({
      ruleId,
      contentVersion,
      contentReviewStatus,
      reviewer,
      reviewDate,
    }),
  ),
};

await Promise.all([
  writeFile(
    resolve(outputRoot, "regulatory-integrity.json"),
    `${JSON.stringify(integrityJson, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputRoot, "rule-selection-audit.json"),
    `${JSON.stringify(selectionJson, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputRoot, "soc2-mapping-playbook-manifest.json"),
    `${JSON.stringify(playbookJson, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputRoot, "rule-catalog-manifest.json"),
    `${JSON.stringify({ ...CATALOG_MANIFEST, actualChecksum }, null, 2)}\n`,
  ),
  writeFile(
    resolve(outputRoot, "regulatory-integrity.md"),
    [
      "# Regulatory integrity report",
      "",
      `Catalog: ${CATALOG_MANIFEST.catalogVersion}`,
      `Pinned commit: ${CATALOG_MANIFEST.commit}`,
      `SHA-256: ${actualChecksum}`,
      "",
      table(
        [
          "Rule ID",
          "Effective force",
          "Statement source",
          "Class-specific",
          "Missing fields",
          "Fallback",
          "Status",
          "Known upstream inconsistency",
          "Effective official statement",
        ],
        REGULATORY_INTEGRITY_REPORT.map((row) => [
          row.ruleId,
          row.effectiveForce,
          row.statementSourcePath,
          row.usesClassSpecificBranch ? "Yes" : "No",
          row.missingRequiredFields.join("; ") || "None",
          row.usedGenericFallbackText ? "Yes" : "No",
          row.integrityStatus,
          row.knownUpstreamInconsistency ?? "None",
          row.effectiveClassAStatement,
        ]),
      ),
      "",
    ].join("\n"),
  ),
  writeFile(
    resolve(outputRoot, "rule-selection-audit.md"),
    [
      "# Rule-selection audit",
      "",
      "Official individual force, official Class A aggregate obligation, and product workflow inclusion are separate fields.",
      "Automated source-to-selection checks are complete. Qualified human review is pending; reviewer and review date remain blank.",
      "",
      table(
        [
          "Rule ID",
          "Official Class A selection",
          "Individual force",
          "Aggregate force",
          "Aggregate source",
          "Workflow categories",
          "Mismatch",
          "Mismatch rationale",
          "Intentional mismatch",
          "Intentional mismatch rationale",
          "Inclusion reason",
          "Review status",
          "Reviewer",
          "Review date",
        ],
        RULE_SELECTION_AUDIT.map((row) => [
          row.id,
          row.officialClassASelection,
          row.officialIndividualForce ?? "Not published in individual rule",
          row.officialSelectionForce ?? "Not in aggregate",
          row.officialSelectionSourceRuleId ?? "None",
          row.workflowCategories.join(", "),
          row.mismatch ? "Yes" : "No",
          row.mismatchRationale ?? "None",
          row.intentionalMismatch ? "Yes" : "No",
          row.intentionalMismatchRationale ?? "None",
          row.productInclusionReason,
          row.reviewStatus,
          row.reviewer ?? "Not assigned",
          row.reviewDate ?? "Not recorded",
        ]),
      ),
      "",
    ].join("\n"),
  ),
]);

process.stdout.write(
  `Regulatory integrity passed for ${REGULATORY_INTEGRITY_REPORT.length} selected rules. Reports: ${outputRoot}\n`,
);
