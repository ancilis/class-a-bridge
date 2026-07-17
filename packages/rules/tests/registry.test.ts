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
  RULE_REGISTRY?: readonly {
    id: string;
    needsFedrampConfirmation?: boolean;
    official: Record<string, unknown>;
    selectionTags: string[];
    source: Record<string, unknown>;
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

  it("preserves official fields and source history without mixing in guidance", () => {
    const registry = api.RULE_REGISTRY ?? [];
    expect(registry.length).toBeGreaterThan(0);
    for (const record of registry) {
      expect(record.official).toEqual(expect.objectContaining({ name: expect.any(String) }));
      expect(record.official).not.toHaveProperty("plainLanguage");
      expect(record.official).not.toHaveProperty("questions");
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
          disclaimer: expect.stringMatching(/not.*FedRAMP.*determination/iu),
          evidenceExamples: expect.arrayContaining([expect.any(String)]),
          mappingHints: expect.arrayContaining([expect.any(String)]),
          plainLanguage: expect.stringMatching(/.{20}/u),
          questions: expect.arrayContaining([expect.any(String)]),
          ruleId: expect.any(String),
          scopeConcerns: expect.arrayContaining([expect.any(String)]),
          suggestedOwner: expect.stringMatching(/\S/u),
        }),
      );
      expect(entry).not.toHaveProperty("statement");
      expect(entry).not.toHaveProperty("force");
    }
  });

  it("flags the CPO-CSF-CPM Class A inconsistency for FedRAMP confirmation", () => {
    const record = (api.RULE_REGISTRY ?? []).find(({ id }) => id === "CPO-CSF-CPM");
    expect(record?.needsFedrampConfirmation).toBe(true);
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
  });
});
