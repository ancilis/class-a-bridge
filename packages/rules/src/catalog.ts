import officialCatalogJson from "../vendor/fedramp-consolidated-rules.json";

import { resolveEffectiveClassARule } from "./normalization";

export const CATALOG_MANIFEST = {
  catalogVersion: "2026.07.14.01",
  commit: "12fe1b60f578ab448c26d143baac99d16d8bfe14",
  sha256: "135707003f0aaa5ceb10d7d32c2681e5b1585a4eaf4403d0d135837787e5ae8e",
  sourceUrl:
    "https://github.com/FedRAMP/rules/blob/12fe1b60f578ab448c26d143baac99d16d8bfe14/fedramp-consolidated-rules.json",
  verifiedAt: "2026-07-17",
} as const;

export const RULE_SELECTIONS = {
  generalProvider: ["FRC-CSO-FCP", "FRC-CSO-PKG", "FRC-CSO-JSN", "FRC-CSO-MRA", "FRC-CSO-POP"],
  externalFramework: [
    "FRC-CLA-ASF",
    "FRC-CLA-EAM",
    "FRC-CLA-MFR",
    "FRC-CLA-RFR",
    "FRC-CLA-OFR",
    "FRC-CLA-IVV",
  ],
  mandatory: [
    "FRC-CSO-PKG",
    "FRC-CSO-JSN",
    "FRC-CSO-POP",
    "MAS-CSO-IIR",
    "CDS-CSO-PUB",
    "CDS-CSO-UTC",
    "CDS-UTC-AAD",
    "AFC-CSO-INB",
    "AFC-CSO-RCV",
    "AFC-CSO-CRA",
    "IEC-CSO-EFR",
    "IEC-CSO-FIR",
    "VDR-CSO-DET",
    "CCM-OCR-AVL",
    "CCM-OCR-NRD",
    "IVV-CSX-AIA",
    "KSI-CMT-LMC",
    "KSI-CNA-RNT",
    "KSI-CED-RAT",
    "KSI-IAM-AAM",
    "KSI-IAM-APM",
    "KSI-INR-RIR",
    "KSI-SVC-SIN",
  ],
  recommended: [
    "CDS-CSO-AVR",
    "CPO-CSF-CPM",
    "CPO-CSX-CPM",
    "IEC-CSO-IIR",
    "IEC-CSO-OIR",
    "VDR-TFR-MVX",
    "VDR-TFR-PCD",
    "VDR-TFR-PDD",
    "VDR-TFR-PSD",
    "VDR-TFR-PVR",
    "VER-TFR-EVU",
  ],
  optional: [
    "CCM-QTR-MTG",
    "CDS-CSO-PSM",
    "CMU-CSO-UVM",
    "FRC-APP-FIA",
    "IVV-CSO-FIA",
    "SDR-CSX-KMT",
    "VER-TFR-IRI",
    "VER-TFR-MRH",
    "VER-TFR-NRI",
  ],
  packageDependencies: ["CPO-CSO-OVR", "SDR-CSO-FRR", "CCM-OCR-AVL", "CPO-CSX-CPM"],
  marketplaceApplication: [
    "MKT-CSO-MLR",
    "MKT-CSO-PML",
    "MKT-IIP-AGU",
    "MKT-IIP-DCP",
    "FRC-APP-MLF",
    "FRC-APP-AFC",
    "FRC-APP-FCP",
    "FRC-APP-NTP",
    "FRC-APP-FIA",
    "FRC-APP-USA",
  ],
} as const;

export type RuleSelection = keyof typeof RULE_SELECTIONS;
export type OfficialClassASelection =
  | "OFFICIALLY_MANDATORY"
  | "OFFICIALLY_RECOMMENDED"
  | "OFFICIALLY_OPTIONAL"
  | "NOT_IN_CLASS_A_AGGREGATE";
export type OfficialRule = Readonly<Record<string, unknown>> & {
  readonly name: string;
  readonly updated?: readonly { readonly date: string; readonly comment: string }[];
};

export interface NormalizedRuleRecord {
  readonly id: string;
  readonly officialTitle: string;
  readonly requirementLevel: string;
  readonly applicability: readonly string[];
  readonly officialSourceReference: string;
  readonly sourceVersion: string;
  readonly effectiveDate: string | null;
  readonly effectiveDateNote: string;
  readonly lastVerifiedDate: string;
  readonly officialText: string;
  readonly classAApplicability: "CLASS_A_BRANCH" | "GENERAL_RULE" | "NO_CLASS_A_BRANCH";
  readonly effectiveOfficial: Readonly<Record<string, unknown>>;
  readonly fieldSourcePaths: Readonly<Record<string, string | null>>;
  readonly officialObjectPath: string;
  readonly usesClassSpecificBranch: boolean;
  readonly usedGenericStatementFallback: boolean;
  readonly officialClassASelection: OfficialClassASelection;
  readonly officialIndividualForce: string | null;
  readonly officialSelectionForce: "MUST" | "SHOULD" | "MAY" | null;
  readonly officialSelectionSourceRuleId: "FRC-CLA-MFR" | "FRC-CLA-RFR" | "FRC-CLA-OFR" | null;
  readonly productInclusionReason: string;
  readonly workflowCategories: readonly string[];
  readonly changeHistory: readonly { readonly date: string; readonly comment: string }[];
  readonly official: OfficialRule;
  readonly selectionTags: readonly RuleSelection[];
  readonly source: {
    readonly catalogVersion: typeof CATALOG_MANIFEST.catalogVersion;
    readonly commit: typeof CATALOG_MANIFEST.commit;
    readonly sourceUrl: string;
    readonly updated: readonly { readonly date: string; readonly comment: string }[];
    readonly verifiedAt: typeof CATALOG_MANIFEST.verifiedAt;
  };
  readonly needsFedrampConfirmation?: true;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface CollectedOfficialRule {
  readonly official: OfficialRule;
  readonly path: string;
}

function collectOfficialRules(
  value: unknown,
  result = new Map<string, CollectedOfficialRule>(),
  path: readonly string[] = [],
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectOfficialRules(item, result, [...path, String(index)]));
    return result;
  }
  if (!isObject(value)) return result;

  for (const [key, child] of Object.entries(value)) {
    if (/^[A-Z0-9]{3}(?:-[A-Z0-9]{3}){2}$/u.test(key) && isObject(child)) {
      if (typeof child.name === "string") {
        if (result.has(key)) throw new Error(`Official catalog contains duplicate rule ${key}`);
        result.set(key, { official: child as OfficialRule, path: [...path, key].join(".") });
      }
    }
    collectOfficialRules(child, result, [...path, key]);
  }
  return result;
}

const officialById = collectOfficialRules(officialCatalogJson);

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const officialRelated = (id: string): readonly string[] => {
  const record = officialById.get(id)?.official;
  if (!record) throw new Error(`Official catalog does not contain aggregate rule ${id}`);
  return stringArray(record.related);
};

export const OFFICIAL_CLASS_A_SELECTIONS = {
  mandatory: officialRelated("FRC-CLA-MFR"),
  recommended: officialRelated("FRC-CLA-RFR"),
  optional: officialRelated("FRC-CLA-OFR"),
} as const;

for (const category of ["mandatory", "recommended", "optional"] as const) {
  const configured = RULE_SELECTIONS[category];
  const official = OFFICIAL_CLASS_A_SELECTIONS[category];
  if (configured.length !== official.length || configured.some((id) => !official.includes(id))) {
    throw new Error(
      `Configured ${category} Class A selection does not match the pinned official aggregate rule`,
    );
  }
}

const selectedIds = [...new Set(Object.values(RULE_SELECTIONS).flat())];

const classASelectionFor = (id: string) => {
  if (OFFICIAL_CLASS_A_SELECTIONS.mandatory.includes(id)) {
    return {
      classification: "OFFICIALLY_MANDATORY" as const,
      force: "MUST" as const,
      sourceRuleId: "FRC-CLA-MFR" as const,
    };
  }
  if (OFFICIAL_CLASS_A_SELECTIONS.recommended.includes(id)) {
    return {
      classification: "OFFICIALLY_RECOMMENDED" as const,
      force: "SHOULD" as const,
      sourceRuleId: "FRC-CLA-RFR" as const,
    };
  }
  if (OFFICIAL_CLASS_A_SELECTIONS.optional.includes(id)) {
    return {
      classification: "OFFICIALLY_OPTIONAL" as const,
      force: "MAY" as const,
      sourceRuleId: "FRC-CLA-OFR" as const,
    };
  }
  return {
    classification: "NOT_IN_CLASS_A_AGGREGATE" as const,
    force: null,
    sourceRuleId: null,
  };
};

const workflowCategoriesFor = (selectionTags: readonly RuleSelection[]) => {
  const categories: string[] = [];
  if (selectionTags.includes("mandatory")) categories.push("class-a-core");
  if (selectionTags.includes("recommended")) categories.push("class-a-recommended");
  if (selectionTags.includes("optional")) categories.push("class-a-optional");
  if (selectionTags.includes("externalFramework")) categories.push("eligibility-prerequisite");
  if (selectionTags.includes("marketplaceApplication")) categories.push("application-prerequisite");
  if (selectionTags.includes("packageDependencies")) categories.push("package-output");
  if (selectionTags.includes("generalProvider")) categories.push("general-provider");
  return categories;
};

const inclusionReasonFor = (
  selection: ReturnType<typeof classASelectionFor>,
  workflowCategories: readonly string[],
) => {
  if (selection.classification === "OFFICIALLY_MANDATORY") {
    return "Included in the pinned official Class A mandatory subset (FRC-CLA-MFR).";
  }
  if (selection.classification === "OFFICIALLY_RECOMMENDED") {
    return "Included in the pinned official Class A recommended subset (FRC-CLA-RFR).";
  }
  if (selection.classification === "OFFICIALLY_OPTIONAL") {
    return "Included in the pinned official Class A optional subset (FRC-CLA-OFR).";
  }
  return `Included for the product workflow: ${workflowCategories.join(", ")}.`;
};

export const RULE_REGISTRY: readonly NormalizedRuleRecord[] = selectedIds.map((id) => {
  const collected = officialById.get(id);
  if (!collected) throw new Error(`Official catalog does not contain selected rule ${id}`);
  const { official, path: officialObjectPath } = collected;
  const effective = resolveEffectiveClassARule(official);
  const selectionTags = Object.entries(RULE_SELECTIONS)
    .filter(([, ids]) => (ids as readonly string[]).includes(id))
    .map(([selection]) => selection as RuleSelection);
  const classASelection = classASelectionFor(id);
  const workflowCategories = workflowCategoriesFor(selectionTags);

  return {
    id,
    officialTitle: official.name,
    requirementLevel: effective.requirementLevel,
    applicability: [
      ...stringArray(official.affects),
      ...stringArray(official.certifications),
      ...stringArray(official.classes),
    ],
    officialSourceReference: `${CATALOG_MANIFEST.sourceUrl}#${id}`,
    sourceVersion: CATALOG_MANIFEST.catalogVersion,
    effectiveDate: typeof official.effective_date === "string" ? official.effective_date : null,
    effectiveDateNote:
      typeof official.effective_date === "string"
        ? "Copied from the official rule record."
        : "The official rule record does not publish a separate effective-date field; no date is inferred.",
    lastVerifiedDate: CATALOG_MANIFEST.verifiedAt,
    officialText: effective.officialText,
    classAApplicability: effective.classAApplicability,
    effectiveOfficial: effective.effectiveOfficial,
    fieldSourcePaths: effective.fieldSourcePaths,
    officialObjectPath,
    usesClassSpecificBranch: effective.usesClassSpecificBranch,
    usedGenericStatementFallback: effective.usedGenericStatementFallback,
    officialClassASelection: classASelection.classification,
    officialIndividualForce:
      effective.requirementLevel === "NOT_PUBLISHED" ? null : effective.requirementLevel,
    officialSelectionForce: classASelection.force,
    officialSelectionSourceRuleId: classASelection.sourceRuleId,
    productInclusionReason: inclusionReasonFor(classASelection, workflowCategories),
    workflowCategories,
    changeHistory: official.updated ?? [],
    official,
    selectionTags,
    source: {
      catalogVersion: CATALOG_MANIFEST.catalogVersion,
      commit: CATALOG_MANIFEST.commit,
      sourceUrl: `${CATALOG_MANIFEST.sourceUrl}#${id}`,
      updated: official.updated ?? [],
      verifiedAt: CATALOG_MANIFEST.verifiedAt,
    },
    ...(id === "CPO-CSF-CPM" ? { needsFedrampConfirmation: true as const } : {}),
  };
});

const CPO_CLASS_A_REMOVAL_DATE = "2026-07-14";
const CPO_CLASS_A_REMOVAL_COMMENT =
  "Removed reference to class A. All class A certifications are 20x.";

/**
 * Matches the pinned catalog's exact FRC-CLA-RFR -> CPO-CSF-CPM discrepancy.
 *
 * This is intentionally a strict fingerprint, not a rule-id allowlist. A future
 * source revision or any additional integrity defect must be reviewed instead of
 * inheriting this catalog-specific exception.
 */
export const isKnownCpoClassAReferenceDiscrepancy = (rule: NormalizedRuleRecord) => {
  const variesByClass = isObject(rule.official.varies_by_class)
    ? rule.official.varies_by_class
    : null;
  const hasClassABranch = variesByClass !== null && Object.hasOwn(variesByClass, "a");
  const recordsClassARemoval = rule.changeHistory.some(
    ({ date, comment }) =>
      date === CPO_CLASS_A_REMOVAL_DATE && comment === CPO_CLASS_A_REMOVAL_COMMENT,
  );
  const officialRecordsClassARemoval = (rule.official.updated ?? []).some(
    ({ date, comment }) =>
      date === CPO_CLASS_A_REMOVAL_DATE && comment === CPO_CLASS_A_REMOVAL_COMMENT,
  );

  return (
    rule.id === "CPO-CSF-CPM" &&
    rule.sourceVersion === CATALOG_MANIFEST.catalogVersion &&
    rule.source.commit === CATALOG_MANIFEST.commit &&
    rule.officialObjectPath === "FRR.CPO.data.rev5.CSF.CPO-CSF-CPM" &&
    rule.officialClassASelection === "OFFICIALLY_RECOMMENDED" &&
    rule.officialSelectionForce === "SHOULD" &&
    rule.officialSelectionSourceRuleId === "FRC-CLA-RFR" &&
    rule.selectionTags.includes("recommended") &&
    rule.workflowCategories.includes("class-a-recommended") &&
    rule.needsFedrampConfirmation === true &&
    rule.classAApplicability === "NO_CLASS_A_BRANCH" &&
    !rule.usesClassSpecificBranch &&
    !rule.usedGenericStatementFallback &&
    !hasClassABranch &&
    recordsClassARemoval &&
    officialRecordsClassARemoval
  );
};

export type RuleSelectionReviewStatus = "QUALIFIED_HUMAN_REVIEW_PENDING";

export interface RuleSelectionAuditEntry {
  readonly id: string;
  readonly officialClassASelection: OfficialClassASelection;
  readonly officialIndividualForce: string | null;
  readonly officialSelectionForce: "MUST" | "SHOULD" | "MAY" | null;
  readonly officialSelectionSourceRuleId: "FRC-CLA-MFR" | "FRC-CLA-RFR" | "FRC-CLA-OFR" | null;
  readonly productInclusionReason: string;
  readonly workflowCategories: readonly string[];
  readonly mismatch: boolean;
  readonly mismatchRationale: string | null;
  readonly intentionalMismatch: boolean;
  readonly intentionalMismatchRationale: string | null;
  readonly reviewStatus: RuleSelectionReviewStatus;
  readonly reviewer: string | null;
  readonly reviewDate: string | null;
}

export const RULE_SELECTION_AUDIT: readonly RuleSelectionAuditEntry[] = RULE_REGISTRY.map(
  (rule) => {
    const mismatch =
      rule.officialClassASelection !== "NOT_IN_CLASS_A_AGGREGATE" &&
      rule.classAApplicability === "NO_CLASS_A_BRANCH";
    const intentionalMismatch = mismatch && isKnownCpoClassAReferenceDiscrepancy(rule);

    return {
      id: rule.id,
      officialClassASelection: rule.officialClassASelection,
      officialIndividualForce: rule.officialIndividualForce,
      officialSelectionForce: rule.officialSelectionForce,
      officialSelectionSourceRuleId: rule.officialSelectionSourceRuleId,
      productInclusionReason: rule.productInclusionReason,
      workflowCategories: rule.workflowCategories,
      mismatch,
      mismatchRationale: mismatch
        ? "The official Class A aggregate includes this rule, while the individual rule publishes no Class A branch."
        : null,
      intentionalMismatch,
      intentionalMismatchRationale: intentionalMismatch
        ? "Ancilis intentionally preserves the pinned upstream FRC-CLA-RFR reference to CPO-CSF-CPM; the individual rule's 2026-07-14 history says Class A applicability was removed. Human confirmation remains required."
        : null,
      reviewStatus: "QUALIFIED_HUMAN_REVIEW_PENDING",
      reviewer: null,
      reviewDate: null,
    };
  },
);

export function getRule(id: string) {
  return RULE_REGISTRY.find((record) => record.id === id);
}
