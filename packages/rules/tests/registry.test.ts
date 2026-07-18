import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as rules from "../src/index";

const MANDATORY_IDS = [
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
] as const;

const RECOMMENDED_IDS = [
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
] as const;

const OPTIONAL_IDS = [
  "CCM-QTR-MTG",
  "CDS-CSO-PSM",
  "CMU-CSO-UVM",
  "FRC-APP-FIA",
  "IVV-CSO-FIA",
  "SDR-CSX-KMT",
  "VER-TFR-IRI",
  "VER-TFR-MRH",
  "VER-TFR-NRI",
] as const;

interface ApiShape {
  CATALOG_MANIFEST?: {
    catalogVersion: string;
    commit: string;
    sha256: string;
    sourceUrl: string;
    verifiedAt: string;
  };
  KSI_WORKFLOWS?: readonly Record<string, unknown>[];
  RULE_GUIDANCE?: readonly Record<string, unknown>[];
  SOC2_MAPPING_PLAYBOOKS?: readonly Record<string, unknown>[];
  SOC2_PLAYBOOK_MANIFEST?: {
    contentVersion: string;
    catalogVersion: string;
    total: number;
    byStatus: Record<string, number>;
  };
  REGULATORY_INTEGRITY_REPORT?: readonly {
    ruleId: string;
    effectiveClassAStatement: string;
    effectiveForce: string;
    statementSourcePath: string | null;
    forceSourcePath: string | null;
    usesClassSpecificBranch: boolean;
    missingRequiredFields: readonly string[];
    usedGenericFallbackText: boolean;
    sourceVersion: string;
    officialObjectPath: string;
    checksumStatus: string;
    integrityStatus: string;
  }[];
  assertRegulatoryIntegrity?: () => void;
  evaluateRegulatoryIntegrity?: (rule: Record<string, unknown>) => {
    integrityStatus: string;
    missingRequiredFields: readonly string[];
    knownUpstreamInconsistency: string | null;
  };
  OFFICIAL_CLASS_A_SELECTIONS?: {
    mandatory: readonly string[];
    optional: readonly string[];
    recommended: readonly string[];
  };
  RULE_SELECTION_AUDIT?: readonly {
    id: string;
    officialClassASelection: string;
    officialIndividualForce: string | null;
    officialSelectionForce: string | null;
    officialSelectionSourceRuleId: string | null;
    productInclusionReason: string;
    workflowCategories: readonly string[];
    mismatch: boolean;
    mismatchRationale: string | null;
    intentionalMismatch: boolean;
    intentionalMismatchRationale: string | null;
    reviewStatus: string;
    reviewer: string | null;
    reviewDate: string | null;
  }[];
  RULE_REGISTRY?: readonly {
    id: string;
    needsFedrampConfirmation?: boolean;
    official: Record<string, unknown>;
    selectionTags: string[];
    source: Record<string, unknown>;
    officialTitle?: string;
    requirementLevel?: string;
    applicability?: readonly string[];
    officialSourceReference?: string;
    sourceVersion?: string;
    effectiveDate?: string | null;
    effectiveDateNote?: string;
    lastVerifiedDate?: string;
    officialText?: string;
    effectiveOfficial?: Record<string, unknown>;
    fieldSourcePaths?: Record<string, string | null>;
    usesClassSpecificBranch?: boolean;
    usedGenericStatementFallback?: boolean;
    officialClassASelection?: string;
    officialIndividualForce?: string | null;
    officialSelectionForce?: string | null;
    officialSelectionSourceRuleId?: string | null;
    productInclusionReason?: string;
    workflowCategories?: readonly string[];
    changeHistory?: readonly Record<string, unknown>[];
  }[];
  RULE_SELECTIONS?: {
    mandatory: readonly string[];
    optional: readonly string[];
    recommended: readonly string[];
  };
}

const api = rules as unknown as ApiShape;

describe("official Class A registry", () => {
  it("pins the requested official catalog release", () => {
    expect(api.CATALOG_MANIFEST).toEqual(
      expect.objectContaining({
        catalogVersion: "2026.07.14.01",
        commit: "12fe1b60f578ab448c26d143baac99d16d8bfe14",
        sha256: "135707003f0aaa5ceb10d7d32c2681e5b1585a4eaf4403d0d135837787e5ae8e",
        verifiedAt: "2026-07-17",
      }),
    );
    expect(api.CATALOG_MANIFEST?.sourceUrl).toMatch(/^https:\/\/github\.com\/FedRAMP\/rules\//u);
  });

  it("vendors bytes with the pinned catalog checksum", () => {
    const vendorPath = fileURLToPath(
      new URL("../vendor/fedramp-consolidated-rules.json", import.meta.url),
    );

    expect(existsSync(vendorPath)).toBe(true);
    const sha256 = existsSync(vendorPath)
      ? createHash("sha256").update(readFileSync(vendorPath)).digest("hex")
      : "missing";
    expect(sha256).toBe("135707003f0aaa5ceb10d7d32c2681e5b1585a4eaf4403d0d135837787e5ae8e");
  });

  it("contains unique normalized rule identifiers", () => {
    const ids = (api.RULE_REGISTRY ?? []).map(({ id }) => id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses the exact requested mandatory, recommended, and optional sets", () => {
    expect([...(api.RULE_SELECTIONS?.mandatory ?? [])].sort()).toEqual([...MANDATORY_IDS].sort());
    expect([...(api.RULE_SELECTIONS?.recommended ?? [])].sort()).toEqual(
      [...RECOMMENDED_IDS].sort(),
    );
    expect([...(api.RULE_SELECTIONS?.optional ?? [])].sort()).toEqual([...OPTIONAL_IDS].sort());
  });

  it("derives Class A selection obligations from the pinned official aggregate rules", () => {
    expect([...(api.OFFICIAL_CLASS_A_SELECTIONS?.mandatory ?? [])].sort()).toEqual(
      [...MANDATORY_IDS].sort(),
    );
    expect([...(api.OFFICIAL_CLASS_A_SELECTIONS?.recommended ?? [])].sort()).toEqual(
      [...RECOMMENDED_IDS].sort(),
    );
    expect([...(api.OFFICIAL_CLASS_A_SELECTIONS?.optional ?? [])].sort()).toEqual(
      [...OPTIONAL_IDS].sort(),
    );
    expect([...(api.RULE_SELECTIONS?.mandatory ?? [])].sort()).toEqual(
      [...(api.OFFICIAL_CLASS_A_SELECTIONS?.mandatory ?? [])].sort(),
    );
    expect([...(api.RULE_SELECTIONS?.recommended ?? [])].sort()).toEqual(
      [...(api.OFFICIAL_CLASS_A_SELECTIONS?.recommended ?? [])].sort(),
    );
    expect([...(api.RULE_SELECTIONS?.optional ?? [])].sort()).toEqual(
      [...(api.OFFICIAL_CLASS_A_SELECTIONS?.optional ?? [])].sort(),
    );
  });

  it("separates individual force, aggregate Class A obligation, and product workflow inclusion", () => {
    const ksi = (api.RULE_REGISTRY ?? []).find(({ id }) => id === "KSI-CMT-LMC");
    expect(ksi).toEqual(
      expect.objectContaining({
        officialClassASelection: "OFFICIALLY_MANDATORY",
        officialIndividualForce: null,
        officialSelectionForce: "MUST",
        officialSelectionSourceRuleId: "FRC-CLA-MFR",
        productInclusionReason: expect.stringMatching(/official Class A mandatory subset/iu),
        workflowCategories: expect.arrayContaining(["class-a-core"]),
      }),
    );
    expect(ksi?.requirementLevel).toBe("NOT_PUBLISHED");

    const optional = (api.RULE_REGISTRY ?? []).find(({ id }) => id === "CCM-QTR-MTG");
    expect(optional).toEqual(
      expect.objectContaining({
        officialClassASelection: "OFFICIALLY_OPTIONAL",
        officialSelectionForce: "MAY",
        officialSelectionSourceRuleId: "FRC-CLA-OFR",
      }),
    );
  });

  it("publishes a complete machine-readable rule-selection audit with no accidental mismatches", () => {
    const audit = api.RULE_SELECTION_AUDIT ?? [];
    expect(audit).toHaveLength(api.RULE_REGISTRY?.length ?? -1);
    expect(new Set(audit.map(({ id }) => id)).size).toBe(audit.length);

    for (const entry of audit) {
      expect(entry).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          officialClassASelection: expect.any(String),
          productInclusionReason: expect.stringMatching(/\S/u),
          workflowCategories: expect.any(Array),
          mismatch: entry.id === "CPO-CSF-CPM",
          mismatchRationale:
            entry.id === "CPO-CSF-CPM" ? expect.stringMatching(/Class A|aggregate/iu) : null,
          intentionalMismatch: entry.id === "CPO-CSF-CPM",
          intentionalMismatchRationale:
            entry.id === "CPO-CSF-CPM" ? expect.stringMatching(/preserv|upstream/iu) : null,
          reviewStatus: "QUALIFIED_HUMAN_REVIEW_PENDING",
          reviewer: null,
          reviewDate: null,
        }),
      );
    }
  });

  it("scopes the known CPO reference exception to the exact upstream discrepancy", () => {
    const evaluate = api.evaluateRegulatoryIntegrity;
    expect(typeof evaluate).toBe("function");
    const cpo = (api.RULE_REGISTRY ?? []).find(({ id }) => id === "CPO-CSF-CPM");
    expect(cpo).toBeDefined();
    if (!evaluate || !cpo) return;

    expect(evaluate(cpo as unknown as Record<string, unknown>)).toEqual(
      expect.objectContaining({
        integrityStatus: "KNOWN_UPSTREAM_INCONSISTENCY",
        missingRequiredFields: ["effective statement"],
        knownUpstreamInconsistency: expect.stringMatching(/FRC-CLA-RFR.*CPO-CSF-CPM/iu),
      }),
    );

    const unrelatedDefects = [
      {
        rule: { ...cpo, officialObjectPath: "" },
        expectedField: "official source path",
      },
      {
        rule: {
          ...cpo,
          officialSelectionForce: null,
          officialSelectionSourceRuleId: null,
        },
        expectedField: "effective or aggregate force",
      },
      {
        rule: { ...cpo, needsFedrampConfirmation: undefined },
        expectedField: "effective statement",
      },
      {
        rule: { ...cpo, official: { ...cpo.official, updated: [] } },
        expectedField: "effective statement",
      },
      {
        rule: {
          ...cpo,
          effectiveOfficial: { statement: "A traceable statement", force: "SHOULD" },
          officialText: "A traceable statement",
          requirementLevel: "SHOULD",
          fieldSourcePaths: {},
        },
        expectedField: "statement source path",
      },
      {
        rule: {
          ...cpo,
          effectiveOfficial: { statement: "A traceable statement", force: "SHOULD" },
          officialText: "A traceable statement",
          requirementLevel: "SHOULD",
          fieldSourcePaths: { statement: "statement" },
        },
        expectedField: "force source path",
      },
    ];

    for (const { rule, expectedField } of unrelatedDefects) {
      const result = evaluate(rule);
      expect(result.integrityStatus).toBe("FAIL");
      expect(result.missingRequiredFields).toContain(expectedField);
      expect(result.knownUpstreamInconsistency).toBeNull();
    }
  });

  it("preserves official fields and source history without mixing in guidance", () => {
    const registry = api.RULE_REGISTRY ?? [];
    expect(registry.length).toBeGreaterThan(0);
    for (const record of registry) {
      expect(record.official).toEqual(expect.objectContaining({ name: expect.any(String) }));
      expect(record.official).not.toHaveProperty("plainLanguage");
      expect(record.official).not.toHaveProperty("questions");
      expect(record).toEqual(
        expect.objectContaining({
          officialTitle: expect.any(String),
          requirementLevel: expect.any(String),
          applicability: expect.any(Array),
          officialSourceReference: expect.stringMatching(/^https:\/\//u),
          sourceVersion: "2026.07.14.01",
          effectiveDateNote: expect.any(String),
          lastVerifiedDate: "2026-07-17",
          officialText: expect.any(String),
          changeHistory: expect.any(Array),
        }),
      );
      expect(record.effectiveDate === null || typeof record.effectiveDate === "string").toBe(true);
      expect(record.source).toEqual(
        expect.objectContaining({
          catalogVersion: "2026.07.14.01",
          commit: "12fe1b60f578ab448c26d143baac99d16d8bfe14",
          sourceUrl: expect.stringMatching(/^https:\/\//u),
          updated: expect.any(Array),
          verifiedAt: "2026-07-17",
        }),
      );
    }
  });

  it("keeps substantive Ancilis guidance separate and explicitly disclaimed", () => {
    const guidance = api.RULE_GUIDANCE ?? [];
    expect(guidance).toHaveLength(api.RULE_REGISTRY?.length ?? -1);
    for (const entry of guidance) {
      expect(entry).toEqual(
        expect.objectContaining({
          authoredBy: "Ancilis",
          contentVersion: expect.any(String),
          contentReviewStatus: "Draft",
          reviewer: null,
          reviewDate: null,
          disclaimer: expect.stringMatching(/not.*FedRAMP.*determination/iu),
          evidenceExamples: expect.arrayContaining([expect.any(String)]),
          whyItMatters: expect.stringMatching(/.{20}/u),
          mappingHints: expect.arrayContaining([expect.any(String)]),
          outputDocumentMappings: expect.arrayContaining([expect.any(String)]),
          jsonSchemaMappings: expect.any(Array),
          plainLanguage: expect.stringMatching(/.{20}/u),
          questions: expect.arrayContaining([expect.any(String)]),
          ruleId: expect.any(String),
          scopeConcerns: expect.arrayContaining([expect.any(String)]),
          suggestedOwner: expect.stringMatching(/\S/u),
        }),
      );
      expect(entry).not.toHaveProperty("statement");
      expect(entry).not.toHaveProperty("force");
      expect(entry.plainLanguage).not.toMatch(/^Explain how /u);
    }
  });

  it("provides a versioned SOC 2 reuse playbook for every selected rule", () => {
    const playbooks = api.SOC2_MAPPING_PLAYBOOKS ?? [];
    expect(playbooks).toHaveLength(api.RULE_REGISTRY?.length ?? -1);
    expect(new Set(playbooks.map((entry) => entry.ruleId)).size).toBe(playbooks.length);

    for (const playbook of playbooks) {
      expect(playbook).toEqual(
        expect.objectContaining({
          ruleId: expect.any(String),
          contentVersion: expect.any(String),
          contentReviewStatus: expect.stringMatching(
            /^(Draft|Technical review complete|Compliance review complete|Claims review complete|Approved for release)$/u,
          ),
          reviewer: null,
          reviewDate: null,
          disclaimer: expect.stringMatching(/Ancilis guidance.*not official FedRAMP text/iu),
          requirementSummary: expect.stringMatching(/.{20}/u),
          intendedOutcome: expect.stringMatching(/.{20}/u),
          trustServicesCriteria: expect.any(Array),
          supportingControlPatterns: expect.arrayContaining([expect.any(String)]),
          insufficientControlPatterns: expect.arrayContaining([expect.any(String)]),
          whatSoc2MayEstablish: expect.arrayContaining([expect.any(String)]),
          whatSoc2UsuallyDoesNotEstablish: expect.arrayContaining([expect.any(String)]),
          scopeChecks: expect.arrayContaining([expect.any(String)]),
          auditPeriodChecks: expect.arrayContaining([expect.any(String)]),
          testResultChecks: expect.arrayContaining([expect.any(String)]),
          exceptionChecks: expect.arrayContaining([expect.any(String)]),
          carveOutChecks: expect.arrayContaining([expect.any(String)]),
          subserviceOrganizationChecks: expect.arrayContaining([expect.any(String)]),
          complementaryControlChecks: expect.arrayContaining([expect.any(String)]),
          commonReusableEvidence: expect.arrayContaining([expect.any(String)]),
          fedrampSpecificEvidenceNeeded: expect.arrayContaining([expect.any(String)]),
          implementationQuestions: expect.arrayContaining([expect.any(String)]),
          verificationQuestions: expect.arrayContaining([expect.any(String)]),
          validationQuestions: expect.arrayContaining([expect.any(String)]),
          commonWeakMappings: expect.arrayContaining([expect.any(String)]),
          strongMappingCharacteristics: expect.arrayContaining([expect.any(String)]),
          commonBlockers: expect.arrayContaining([expect.any(String)]),
          organizationalOwner: expect.stringMatching(/\S/u),
          technicalTeams: expect.arrayContaining([expect.any(String)]),
          expertReviewTriggers: expect.arrayContaining([expect.any(String)]),
          narrativeOutline: expect.arrayContaining([expect.any(String)]),
          officialSourceReferences: expect.arrayContaining([expect.stringMatching(/^https:\/\//u)]),
          keywords: expect.arrayContaining([expect.any(String)]),
        }),
      );
    }

    expect(api.SOC2_PLAYBOOK_MANIFEST).toEqual(
      expect.objectContaining({
        catalogVersion: "2026.07.14.01",
        total: playbooks.length,
        byStatus: expect.objectContaining({ Draft: playbooks.length }),
      }),
    );
  });

  it("uses rule-specific SOC 2 reuse guidance for release-critical workflows", () => {
    const playbooks = api.SOC2_MAPPING_PLAYBOOKS ?? [];
    const fir = playbooks.find(({ ruleId }) => ruleId === "IEC-CSO-FIR");
    const assessment = playbooks.find(({ ruleId }) => ruleId === "IVV-CSX-AIA");
    const logging = playbooks.find(({ ruleId }) => ruleId === "KSI-CMT-LMC");

    expect(JSON.stringify(fir)).toMatch(/final incident report/iu);
    expect(JSON.stringify(fir)).toMatch(/three business days/iu);
    expect(JSON.stringify(assessment)).toMatch(/underlying alternative security framework/iu);
    expect(JSON.stringify(logging)).toMatch(/emergency changes/iu);

    for (const playbook of playbooks.filter(({ ruleId }) =>
      MANDATORY_IDS.includes(ruleId as (typeof MANDATORY_IDS)[number]),
    )) {
      expect(JSON.stringify(playbook)).not.toMatch(/Explain how this requirement applies/iu);
      expect((playbook.trustServicesCriteria as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it("flags the CPO-CSF-CPM Class A inconsistency for FedRAMP confirmation", () => {
    const record = (api.RULE_REGISTRY ?? []).find(({ id }) => id === "CPO-CSF-CPM");
    expect(record?.needsFedrampConfirmation).toBe(true);
  });

  it.each([
    [
      "IEC-CSO-FIR",
      "Providers with Class A Certifications MUST responsibly notify all affected parties",
      "MUST",
    ],
    ["IVV-CSX-AIA", "Providers with 20x Class A Certifications MUST meet the expectations", "MUST"],
  ])(
    "uses the effective Class A branch for %s",
    (ruleId, expectedStatementFragment, expectedForce) => {
      const record = (api.RULE_REGISTRY ?? []).find(({ id }) => id === ruleId);

      expect(record).toEqual(
        expect.objectContaining({
          requirementLevel: expectedForce,
          usesClassSpecificBranch: true,
          usedGenericStatementFallback: false,
          fieldSourcePaths: expect.objectContaining({
            statement: "varies_by_class.a.statement",
            force: "varies_by_class.a.force",
          }),
          effectiveOfficial: expect.objectContaining({
            statement: expect.stringContaining(expectedStatementFragment),
            force: expectedForce,
          }),
        }),
      );
      expect(record?.officialText).toContain(expectedStatementFragment);
      expect(record?.officialText).not.toBe(record?.officialTitle);
    },
  );

  it("normalizes every selected Class A branch with traceable field provenance", () => {
    const classSpecific = (api.RULE_REGISTRY ?? []).filter(({ official }) => {
      const variants = official.varies_by_class;
      return (
        typeof variants === "object" &&
        variants !== null &&
        !Array.isArray(variants) &&
        typeof (variants as Record<string, unknown>).a === "object" &&
        (variants as Record<string, unknown>).a !== null
      );
    });

    expect(classSpecific.length).toBeGreaterThan(0);
    for (const record of classSpecific) {
      const classA = (record.official.varies_by_class as Record<string, unknown>).a as Record<
        string,
        unknown
      >;
      expect(record.usesClassSpecificBranch).toBe(true);
      expect(record.officialText).toBe(classA.statement);
      expect(record.requirementLevel).toBe(classA.force);
      expect(record.fieldSourcePaths?.statement).toBe("varies_by_class.a.statement");
      expect(record.fieldSourcePaths?.force).toBe("varies_by_class.a.force");
      expect(record.effectiveOfficial?.statement).toBe(classA.statement);
      expect(record.effectiveOfficial?.force).toBe(classA.force);
      expect(record.usedGenericStatementFallback).toBe(false);

      for (const field of [
        "artifacts",
        "assessment",
        "assessment_expectations",
        "exceptions",
        "pain_timeframes",
        "timeframe_num",
        "timeframe_type",
      ]) {
        if (Object.hasOwn(classA, field)) {
          expect(record.effectiveOfficial?.[field]).toEqual(classA[field]);
          expect(record.fieldSourcePaths?.[field]).toBe(`varies_by_class.a.${field}`);
        }
      }
    }
  });

  it("never resolves a mandatory workflow record to its title or an available force to UNSPECIFIED", () => {
    const mandatory = new Set(api.RULE_SELECTIONS?.mandatory ?? []);
    for (const record of api.RULE_REGISTRY ?? []) {
      const variants = record.official.varies_by_class as
        { a?: Record<string, unknown> } | undefined;
      const availableForce = variants?.a?.force ?? record.official.force;

      if (mandatory.has(record.id)) {
        expect((record.officialText ?? "").trim()).not.toBe("");
        expect(record.officialText).not.toBe(record.officialTitle);
      }
      if (typeof availableForce === "string") {
        expect(record.requirementLevel).toBe(availableForce);
        expect(record.requirementLevel).not.toBe("UNSPECIFIED");
      }
    }
  });

  it("generates a complete regulatory integrity report and passes deterministic release gates", () => {
    expect(() => api.assertRegulatoryIntegrity?.()).not.toThrow();
    const report = api.REGULATORY_INTEGRITY_REPORT ?? [];
    expect(report).toHaveLength(api.RULE_REGISTRY?.length ?? -1);

    for (const row of report) {
      expect(row).toEqual(
        expect.objectContaining({
          ruleId: expect.any(String),
          effectiveClassAStatement: expect.any(String),
          effectiveForce: expect.any(String),
          usesClassSpecificBranch: expect.any(Boolean),
          missingRequiredFields: expect.any(Array),
          usedGenericFallbackText: false,
          sourceVersion: "2026.07.14.01",
          officialObjectPath: expect.stringMatching(/\S/u),
          checksumStatus: "MATCHES_PINNED_MANIFEST",
          integrityStatus: expect.stringMatching(/^(PASS|KNOWN_UPSTREAM_INCONSISTENCY)$/u),
        }),
      );
      if (row.usesClassSpecificBranch) {
        expect(row.statementSourcePath).toBe("varies_by_class.a.statement");
        expect(row.forceSourcePath).toBe("varies_by_class.a.force");
      }
    }

    const known = report.filter(
      ({ integrityStatus }) => integrityStatus === "KNOWN_UPSTREAM_INCONSISTENCY",
    );
    expect(known.map(({ ruleId }) => ruleId)).toEqual(["CPO-CSF-CPM"]);
  });

  it("defines seven complete, dedicated KSI workflows", () => {
    const workflows = api.KSI_WORKFLOWS ?? [];
    expect(workflows).toHaveLength(7);
    expect(workflows.map(({ ruleId }) => ruleId).sort()).toEqual(
      MANDATORY_IDS.filter((id) => id.startsWith("KSI-")).sort(),
    );
    for (const workflow of workflows) {
      expect(workflow).toEqual(
        expect.objectContaining({
          collectorPrompts: expect.arrayContaining([expect.any(String)]),
          contentVersion: expect.any(String),
          contentReviewStatus: "Draft",
          reviewer: null,
          reviewDate: null,
          disclaimer: expect.stringMatching(/human review/iu),
          implementationSteps: expect.arrayContaining([expect.any(String)]),
          narrativeSections: expect.arrayContaining([expect.any(String)]),
          outcome: expect.stringMatching(/.{20}/u),
          technicalHelpers: expect.arrayContaining([expect.any(String)]),
          uncertainties: expect.arrayContaining([expect.any(String)]),
          validationSteps: expect.arrayContaining([expect.any(String)]),
          verificationSteps: expect.arrayContaining([expect.any(String)]),
          weaknesses: expect.arrayContaining([expect.any(String)]),
        }),
      );
    }
    expect(
      new Set(workflows.map(({ implementationSteps }) => JSON.stringify(implementationSteps))).size,
    ).toBe(7);
    expect(
      new Set(workflows.map(({ verificationSteps }) => JSON.stringify(verificationSteps))).size,
    ).toBe(7);
    expect(
      new Set(workflows.map(({ validationSteps }) => JSON.stringify(validationSteps))).size,
    ).toBe(7);
  });
});
