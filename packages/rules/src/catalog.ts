import officialCatalogJson from "../vendor/fedramp-consolidated-rules.json";

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
export type OfficialRule = Readonly<Record<string, unknown>> & {
  readonly name: string;
  readonly updated?: readonly { readonly date: string; readonly comment: string }[];
};

export interface NormalizedRuleRecord {
  readonly id: string;
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

export interface RuleGuidanceRecord {
  readonly authoredBy: "Ancilis";
  readonly disclaimer: string;
  readonly evidenceExamples: readonly string[];
  readonly mappingHints: readonly string[];
  readonly plainLanguage: string;
  readonly questions: readonly string[];
  readonly ruleId: string;
  readonly scopeConcerns: readonly string[];
  readonly suggestedOwner: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function collectOfficialRules(value: unknown, result = new Map<string, OfficialRule>()) {
  if (Array.isArray(value)) {
    for (const item of value) collectOfficialRules(item, result);
    return result;
  }
  if (!isObject(value)) return result;

  for (const [key, child] of Object.entries(value)) {
    if (/^[A-Z0-9]{3}(?:-[A-Z0-9]{3}){2}$/u.test(key) && isObject(child)) {
      if (typeof child.name === "string") result.set(key, child as OfficialRule);
    }
    collectOfficialRules(child, result);
  }
  return result;
}

const officialById = collectOfficialRules(officialCatalogJson);
const selectedIds = [...new Set(Object.values(RULE_SELECTIONS).flat())];

export const RULE_REGISTRY: readonly NormalizedRuleRecord[] = selectedIds.map((id) => {
  const official = officialById.get(id);
  if (!official) throw new Error(`Official catalog does not contain selected rule ${id}`);
  const selectionTags = Object.entries(RULE_SELECTIONS)
    .filter(([, ids]) => (ids as readonly string[]).includes(id))
    .map(([selection]) => selection as RuleSelection);

  return {
    id,
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

const ownerFor = (id: string) => {
  if (id.startsWith("KSI-")) return "Security engineering lead";
  if (id.startsWith("MKT-")) return "Marketplace program owner";
  if (/^(CPO|SDR)-/u.test(id)) return "Certification package owner";
  if (/^(IEC|CCM)-/u.test(id)) return "Security operations lead";
  if (/^(VDR|VER)-/u.test(id)) return "Vulnerability management lead";
  if (id.startsWith("IVV-")) return "Independent assessment coordinator";
  return "FedRAMP program owner";
};

export const RULE_GUIDANCE: readonly RuleGuidanceRecord[] = RULE_REGISTRY.map(
  ({ id, official }) => {
    const related = Array.isArray(official.related)
      ? official.related.filter((item): item is string => typeof item === "string")
      : [];
    const controls = Array.isArray(official.controls)
      ? official.controls.filter((item): item is string => typeof item === "string")
      : [];
    const mappingTargets = [...related, ...controls];

    return {
      authoredBy: "Ancilis",
      disclaimer:
        "Ancilis guidance supports preparation only; it is not a FedRAMP determination, certification, legal opinion, or substitute for provider and assessor review.",
      evidenceExamples: [
        `A dated policy, configuration export, operating record, or review result that directly supports ${official.name}.`,
        "An owner-approved explanation connecting the evidence to the federal offering and its current scope.",
      ],
      mappingHints: [
        mappingTargets.length > 0
          ? `Confirm mappings to official references: ${mappingTargets.join(", ")}.`
          : "Map only confirmed SOC 2 controls or evidence whose scope and test period match this rule.",
      ],
      plainLanguage: `Explain how ${official.name} applies to the federal cloud offering, who owns it, and how a reviewer can verify that it operates as described.`,
      questions: [
        `What current process or technical measure addresses ${official.name}?`,
        "What remains uncertain, out of scope, dependent on a third party, or awaiting human approval?",
      ],
      ruleId: id,
      scopeConcerns: [
        "Confirm the evidence covers the proposed federal offering, federal-data boundary, dependencies, and relevant assessment period.",
      ],
      suggestedOwner: ownerFor(id),
    };
  },
);

export function getRule(id: string) {
  return RULE_REGISTRY.find((record) => record.id === id);
}
