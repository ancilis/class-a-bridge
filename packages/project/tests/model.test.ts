import { describe, expect, it } from "vitest";

import { BridgeProjectSchema, createEmptyProject, migrateProject } from "../src/index";

const requirementDraft = () => ({
  ruleId: "KSI-IAM-AAM",
  status: "approved_by_provider" as const,
  reviewStatus: "approved" as const,
  userResponse: "The provider uses centralized account-management workflows.",
  implementationNarrative: "Lifecycle events trigger managed account changes.",
  verificationNarrative: "The identity team reviews lifecycle events monthly.",
  validationNarrative: "A reviewer samples completed lifecycle events quarterly.",
  independentVerification: "",
  independentValidation: "",
  soc2ControlIds: [],
  soc2PageReferences: [],
  evidenceIds: [],
  owner: "Identity engineering",
  notes: "",
  openQuestions: [],
  exceptions: [],
});

describe("BridgeProject", () => {
  it("creates a strict, versioned local-first project", () => {
    const project = createEmptyProject("Northstar Federal", "Northstar Cloud");
    expect(BridgeProjectSchema.parse(project)).toEqual(project);
    expect(project.metadata).toEqual(
      expect.objectContaining({ schemaVersion: 1, ruleCatalogVersion: "2026.07.14.01" }),
    );
    expect(project.approvals).toEqual([]);
    expect(() => BridgeProjectSchema.parse({ ...project, injected: true })).toThrow();
  });

  it("requires a visible watermark for fictional sample projects", () => {
    const project = createEmptyProject("Sample", "Fictional Co");
    project.metadata.isSample = true;
    expect(() => BridgeProjectSchema.parse(project)).toThrow(/watermark/iu);
    project.metadata.watermark = "Fictional example — not for submission.";
    expect(BridgeProjectSchema.parse(project)).toEqual(project);
  });

  it("migrates legacy projects and records migration history", () => {
    const migrated = migrateProject({
      schemaVersion: 0,
      projectName: "Legacy",
      organizationName: "Old Co",
    });
    expect(migrated.metadata.name).toBe("Legacy");
    expect(migrated.organization.name).toBe("Old Co");
    expect(migrated.metadata.migrations).toEqual([
      expect.objectContaining({ from: 0, to: 1, id: "v0-to-v1" }),
    ]);
    expect(BridgeProjectSchema.parse(migrated)).toEqual(migrated);
  });

  it("defaults the optional package logo field when an older v1 project is restored", () => {
    const project = createEmptyProject("Existing", "Existing Co");
    const legacyShape = structuredClone(project) as Record<string, unknown>;
    const packageInputs = legacyShape.packageInputs as {
      certificationPackageOverview: Record<string, unknown>;
    };
    delete packageInputs.certificationPackageOverview.logoUrl;

    expect(
      BridgeProjectSchema.parse(legacyShape).packageInputs.certificationPackageOverview.logoUrl,
    ).toBe("");
  });

  it("records unresolved package freshness without inventing a fresh status", () => {
    const project = createEmptyProject("Final review", "Provider");
    project.snapshots.push({
      id: "snapshot-1",
      version: "1.0",
      createdAt: "2026-07-17T00:00:00.000Z",
      providerApprover: "Provider approver",
      verificationDate: "2026-07-17",
      validationDate: "2026-07-17",
      projectHash: "a".repeat(64),
      packageHash: "b".repeat(64),
      freshnessStatus: "needs_confirmation",
      unresolvedItems: ["Confirm the SOC 2 report date."],
      immutable: true,
    });

    expect(BridgeProjectSchema.parse(project).snapshots[0]?.freshnessStatus).toBe(
      "needs_confirmation",
    );
  });

  it("rejects provider-approved status without a named approver and valid approval time", () => {
    const project = createEmptyProject("Approval integrity", "Provider");
    project.requirements.push(requirementDraft());

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/providerApprovedBy/iu);

    project.requirements[0]!.providerApprovedBy = "   ";
    project.requirements[0]!.providerApprovedAt = "2026-07-17T15:00:00.000Z";
    expect(() => BridgeProjectSchema.parse(project)).toThrow(/providerApprovedBy/iu);

    project.requirements[0]!.providerApprovedBy = "Provider representative";
    project.requirements[0]!.providerApprovedAt = "not-a-date";
    expect(() => BridgeProjectSchema.parse(project)).toThrow(/providerApprovedAt/iu);
  });

  it.each([
    "userResponse",
    "implementationNarrative",
    "verificationNarrative",
    "validationNarrative",
  ] as const)("rejects provider-approved status with blank %s", (field) => {
    const project = createEmptyProject("Approval integrity", "Provider");
    project.requirements.push({
      ...requirementDraft(),
      providerApprovedBy: "Provider representative",
      providerApprovedAt: "2026-07-17T15:00:00.000Z",
      [field]: "   ",
    });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(new RegExp(field, "iu"));
  });

  it("accepts provider approval only with complete core narratives and approval metadata", () => {
    const project = createEmptyProject("Approval integrity", "Provider");
    project.requirements.push({
      ...requirementDraft(),
      providerApprovedBy: "Provider representative",
      providerApprovedAt: "2026-07-17T15:00:00.000Z",
    });

    expect(BridgeProjectSchema.parse(project).requirements[0]?.status).toBe("approved_by_provider");
  });
});
