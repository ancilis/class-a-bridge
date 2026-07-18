import {
  CATALOG_MANIFEST,
  isKnownCpoClassAReferenceDiscrepancy,
  RULE_REGISTRY,
  RULE_SELECTION_AUDIT,
  type NormalizedRuleRecord,
} from "./catalog";

export type RegulatoryIntegrityStatus = "PASS" | "KNOWN_UPSTREAM_INCONSISTENCY" | "FAIL";

export interface RegulatoryIntegrityRow {
  readonly ruleId: string;
  readonly ruleTitle: string;
  readonly effectiveClassAStatement: string;
  readonly effectiveForce: string;
  readonly statementSourcePath: string | null;
  readonly forceSourcePath: string | null;
  readonly usesClassSpecificBranch: boolean;
  readonly missingRequiredFields: readonly string[];
  readonly usedGenericFallbackText: boolean;
  readonly sourceVersion: string;
  readonly officialObjectPath: string;
  readonly checksumStatus: "MATCHES_PINNED_MANIFEST";
  readonly knownUpstreamInconsistency: string | null;
  readonly integrityStatus: RegulatoryIntegrityStatus;
}

const CPO_REFERENCE_DISCREPANCY =
  "FRC-CLA-RFR references CPO-CSF-CPM even though the individual rule's pinned source removed Class A applicability.";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const evaluateRegulatoryIntegrity = (rule: NormalizedRuleRecord): RegulatoryIntegrityRow => {
  const missingRequiredFields: string[] = [];
  const sourceStatement = rule.effectiveOfficial.statement;
  const sourceForce = rule.effectiveOfficial.force;
  const isOfficiallySelected = rule.officialClassASelection !== "NOT_IN_CLASS_A_AGGREGATE";

  if (!isNonEmptyString(sourceStatement)) missingRequiredFields.push("effective statement");
  if (
    isOfficiallySelected &&
    !isNonEmptyString(sourceForce) &&
    rule.officialSelectionForce === null
  ) {
    missingRequiredFields.push("effective or aggregate force");
  }
  if (!rule.officialObjectPath) missingRequiredFields.push("official source path");
  if (isNonEmptyString(sourceStatement) && !rule.fieldSourcePaths.statement) {
    missingRequiredFields.push("statement source path");
  }
  if (isNonEmptyString(sourceForce) && !rule.fieldSourcePaths.force) {
    missingRequiredFields.push("force source path");
  }
  if (isNonEmptyString(sourceStatement) && rule.officialText !== sourceStatement) {
    missingRequiredFields.push("displayed official text differs from normalized source");
  }
  if (isNonEmptyString(sourceForce) && rule.requirementLevel !== sourceForce) {
    missingRequiredFields.push("effective force differs from normalized source");
  }
  if (rule.officialText === rule.officialTitle) {
    missingRequiredFields.push("title used as requirement text");
  }

  const isExactKnownDiscrepancy =
    isKnownCpoClassAReferenceDiscrepancy(rule) &&
    !isNonEmptyString(sourceStatement) &&
    !isNonEmptyString(sourceForce) &&
    rule.officialText === "" &&
    rule.requirementLevel === "NOT_PUBLISHED" &&
    (rule.fieldSourcePaths.statement ?? null) === null &&
    (rule.fieldSourcePaths.force ?? null) === null &&
    missingRequiredFields.length === 1 &&
    missingRequiredFields[0] === "effective statement";

  return {
    ruleId: rule.id,
    ruleTitle: rule.officialTitle,
    effectiveClassAStatement: rule.officialText,
    effectiveForce: rule.requirementLevel,
    statementSourcePath: rule.fieldSourcePaths.statement ?? null,
    forceSourcePath: rule.fieldSourcePaths.force ?? null,
    usesClassSpecificBranch: rule.usesClassSpecificBranch,
    missingRequiredFields,
    usedGenericFallbackText: rule.usedGenericStatementFallback,
    sourceVersion: rule.sourceVersion,
    officialObjectPath: rule.officialObjectPath,
    checksumStatus: "MATCHES_PINNED_MANIFEST",
    knownUpstreamInconsistency: isExactKnownDiscrepancy ? CPO_REFERENCE_DISCREPANCY : null,
    integrityStatus: isExactKnownDiscrepancy
      ? "KNOWN_UPSTREAM_INCONSISTENCY"
      : missingRequiredFields.length === 0
        ? "PASS"
        : "FAIL",
  };
};

export const REGULATORY_INTEGRITY_REPORT: readonly RegulatoryIntegrityRow[] = RULE_REGISTRY.map(
  evaluateRegulatoryIntegrity,
);

export function assertRegulatoryIntegrity() {
  const failures = REGULATORY_INTEGRITY_REPORT.filter(
    ({ integrityStatus }) => integrityStatus === "FAIL",
  );
  const selectionFailures = RULE_SELECTION_AUDIT.filter(
    ({ mismatch, intentionalMismatch }) => mismatch && !intentionalMismatch,
  );

  if (failures.length > 0 || selectionFailures.length > 0) {
    const details = [
      ...failures.map(
        ({ ruleId, missingRequiredFields }) =>
          `${ruleId}: ${missingRequiredFields.join(", ") || "integrity failure"}`,
      ),
      ...selectionFailures.map(({ id }) => `${id}: rule-selection mismatch`),
    ];
    throw new Error(
      `Regulatory integrity failed for catalog ${CATALOG_MANIFEST.catalogVersion}: ${details.join("; ")}`,
    );
  }
}

assertRegulatoryIntegrity();
