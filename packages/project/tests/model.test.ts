import { describe, expect, it } from "vitest";

import { RULE_SELECTIONS } from "@class-a-bridge/rules";

import {
  BridgeProjectSchema,
  createEmptyProject,
  finalReviewApprovalScope,
  migrateProject,
  type BridgeProject,
} from "../src/index";

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
    expect(project.requirements.map(({ ruleId }) => ruleId)).toEqual(RULE_SELECTIONS.mandatory);
    expect(() => BridgeProjectSchema.parse({ ...project, injected: true })).toThrow();
  });

  it("rejects a project that omits a mandatory Class A requirement", () => {
    const project = createEmptyProject("Missing requirement", "Provider");
    project.requirements = project.requirements.filter(({ ruleId }) => ruleId !== "FRC-CSO-PKG");

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/mandatory.*FRC-CSO-PKG/iu);
  });

  it("rejects requirement records outside the pinned rule registry", () => {
    const project = createEmptyProject("Unknown requirement", "Provider");
    project.requirements.push({
      ...requirementDraft(),
      ruleId: "UNKNOWN-RULE",
    });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/pinned rule catalog/iu);
  });

  it("rejects evidence and mapping references that do not resolve to project requirements", () => {
    const project = createEmptyProject("Unknown references", "Provider");
    project.evidence.push({
      id: "evidence-1",
      title: "Access review",
      description: "A local evidence candidate.",
      kind: "report",
      owner: "Security",
      collectedAt: "2026-07-17",
      relatedRequirementIds: ["UNKNOWN-RULE"],
      relatedSoc2ControlIds: [],
      sha256: "a".repeat(64),
      sensitivity: "confidential",
      notes: "",
      reviewStatus: "candidate",
    });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/evidence.*UNKNOWN-RULE/iu);

    project.evidence[0]!.relatedRequirementIds = ["FRC-CSO-PKG"];
    project.mappings.push({
      id: "mapping-1",
      soc2ControlId: "SOC2-1",
      reportPage: 1,
      excerpt: "",
      classARuleId: "UNKNOWN-RULE",
      coverage: "needs_human_review",
      reason: "Needs confirmation.",
      gapDescription: "",
      additionalEvidenceNeeded: "",
      suggested: false,
      confirmed: false,
    });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/mapping.*UNKNOWN-RULE/iu);
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
    project.generatedOutputs.push({
      id: "package-1",
      kind: "preparation_package",
      title: "Preparation package 1.0",
      format: "zip",
      generatedAt: "2026-07-17T00:00:00.000Z",
      sha256: "b".repeat(64),
      validationStatus: "valid",
      validationIssues: [],
    });
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

  it("requires real review dates and named snapshot fields", () => {
    const project = createEmptyProject("Snapshot field integrity", "Provider");
    project.generatedOutputs.push({
      id: "package-1",
      kind: "preparation_package",
      title: "Preparation package 1.0",
      format: "zip",
      generatedAt: "2026-07-17T00:00:00.000Z",
      sha256: "b".repeat(64),
      validationStatus: "valid",
      validationIssues: [],
    });
    project.snapshots.push({
      id: "snapshot-1",
      version: " ",
      createdAt: "2026-07-17T00:00:00.000Z",
      providerApprover: "Provider approver",
      verificationDate: "today",
      validationDate: "2026-07-17",
      projectHash: "a".repeat(64),
      packageHash: "b".repeat(64),
      freshnessStatus: "needs_confirmation",
      unresolvedItems: [],
      immutable: true,
    });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/version|verificationDate/iu);

    project.snapshots[0]!.version = "1.0";
    project.snapshots[0]!.verificationDate = "2026-07-18";
    expect(() => BridgeProjectSchema.parse(project)).toThrow(/after.*snapshot/iu);
  });

  it("accepts final internal-review approval only when it binds the immutable snapshot", () => {
    const project = createEmptyProject("Approval binding", "Provider");
    project.generatedOutputs.push({
      id: "package-1",
      kind: "preparation_package",
      title: "Preparation package 1.0",
      format: "zip",
      generatedAt: "2026-07-17T00:00:00.000Z",
      sha256: "b".repeat(64),
      validationStatus: "valid",
      validationIssues: [],
    });
    project.snapshots.push({
      id: "snapshot-1",
      version: "1.0",
      createdAt: "2026-07-17T00:00:00.000Z",
      providerApprover: "Provider approver",
      verificationDate: "2026-07-16",
      validationDate: "2026-07-17",
      projectHash: "a".repeat(64),
      packageHash: "b".repeat(64),
      freshnessStatus: "needs_confirmation",
      unresolvedItems: [],
      immutable: true,
    });
    project.approvals.push({
      id: "approval-1",
      kind: "final_internal_review",
      title: "Final internal review",
      approver: "Provider approver",
      role: "Provider approver",
      acceptedAt: "2026-07-17T15:00:00.000Z",
      scope: "Snapshot ID: snapshot-1;",
      notes: "Not a FedRAMP approval.",
    });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/immutable snapshot/iu);

    const approval = project.approvals[0];
    if (!approval) throw new Error("Approval fixture was not created.");
    approval.scope = finalReviewApprovalScope(project.snapshots[0]!);
    expect(BridgeProjectSchema.parse(project).approvals[0]?.id).toBe("approval-1");

    approval.acceptedAt = "2026-07-16T15:00:00.000Z";
    expect(() => BridgeProjectSchema.parse(project)).toThrow(/before.*snapshot/iu);
    approval.acceptedAt = "2026-07-17T15:00:00.000Z";

    const mutateBoundSnapshot = (
      label: string,
      mutate: (snapshot: BridgeProject["snapshots"][number]) => void,
    ) => {
      const mutatedProject = structuredClone(project);
      mutate(mutatedProject.snapshots[0]!);
      expect(
        () => BridgeProjectSchema.parse(mutatedProject),
        `${label} must remain bound to the final approval`,
      ).toThrow(/immutable snapshot/iu);
    };

    mutateBoundSnapshot("identifier", (snapshot) => {
      snapshot.id = "snapshot-2";
    });
    mutateBoundSnapshot("version", (snapshot) => {
      snapshot.version = "1.1";
    });
    mutateBoundSnapshot("creation timestamp", (snapshot) => {
      snapshot.createdAt = "2026-07-17T01:00:00.000Z";
    });
    mutateBoundSnapshot("provider approver", (snapshot) => {
      snapshot.providerApprover = "Different approver";
    });
    mutateBoundSnapshot("verification date", (snapshot) => {
      snapshot.verificationDate = "2026-07-15";
    });
    mutateBoundSnapshot("validation date", (snapshot) => {
      snapshot.validationDate = "2026-07-16";
    });
    mutateBoundSnapshot("project hash", (snapshot) => {
      snapshot.projectHash = "c".repeat(64);
    });
    mutateBoundSnapshot("package hash", (snapshot) => {
      snapshot.packageHash = "d".repeat(64);
    });
    mutateBoundSnapshot("freshness status", (snapshot) => {
      snapshot.freshnessStatus = "fresh";
    });
    mutateBoundSnapshot("unresolved items", (snapshot) => {
      snapshot.unresolvedItems = ["New unresolved representation."];
    });

    const mutableFlagProject = structuredClone(project);
    (
      mutableFlagProject.snapshots[0] as unknown as {
        immutable: boolean;
      }
    ).immutable = false;
    expect(() => BridgeProjectSchema.parse(mutableFlagProject)).toThrow(/immutable/iu);
  });

  it("rejects duplicate generated-output identifiers", () => {
    const project = createEmptyProject("Output integrity", "Provider");
    const output = {
      id: "package-1",
      kind: "preparation_package",
      title: "Preparation package 1.0",
      format: "zip" as const,
      generatedAt: "2026-07-17T00:00:00.000Z",
      sha256: "b".repeat(64),
      validationStatus: "valid" as const,
      validationIssues: [],
    };
    project.generatedOutputs.push(output, { ...output, title: "Duplicate package" });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/generated output.*unique/iu);
  });

  it("rejects duplicate evidence identifiers", () => {
    const project = createEmptyProject("Evidence identity", "Provider");
    const evidence = {
      id: "evidence-1",
      title: "Access review",
      description: "A local evidence candidate.",
      kind: "report" as const,
      owner: "Security",
      collectedAt: "2026-07-17",
      relatedRequirementIds: [],
      relatedSoc2ControlIds: [],
      sha256: "a".repeat(64),
      sensitivity: "confidential" as const,
      notes: "",
      reviewStatus: "candidate" as const,
    };
    project.evidence.push(evidence, { ...evidence, title: "Duplicate access review" });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/evidence identifier.*unique/iu);
  });

  it("rejects duplicate requirement rule identifiers", () => {
    const project = createEmptyProject("Requirement identity", "Provider");
    const requirement = {
      ...requirementDraft(),
      status: "drafted" as const,
      reviewStatus: "in_review" as const,
    };
    project.requirements.push(requirement, { ...requirement });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(
      /requirement rule identifier.*unique/iu,
    );
  });

  it("rejects a generated-output identifier that collides with a local attachment", () => {
    const project = createEmptyProject("Output integrity", "Provider");
    project.soc2.sourceReport = {
      fileName: "soc-2.pdf",
      attachmentId: "package-1",
      sha256: "a".repeat(64),
    };
    project.generatedOutputs.push({
      id: "package-1",
      kind: "preparation_package",
      title: "Preparation package 1.0",
      format: "zip",
      generatedAt: "2026-07-17T00:00:00.000Z",
      sha256: "b".repeat(64),
      validationStatus: "valid",
      validationIssues: [],
    });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/generated output.*attachment/iu);
  });

  it("requires every immutable snapshot package hash to bind to a generated output", () => {
    const project = createEmptyProject("Snapshot integrity", "Provider");
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
      unresolvedItems: [],
      immutable: true,
    });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/packageHash.*generated output/iu);
  });

  it("rejects provider-approved status without a named approver and valid approval time", () => {
    const project = createEmptyProject("Approval integrity", "Provider");
    const index = project.requirements.findIndex(({ ruleId }) => ruleId === "KSI-IAM-AAM");
    project.requirements[index] = requirementDraft();

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/providerApprovedBy/iu);

    project.requirements[index].providerApprovedBy = "   ";
    project.requirements[index].providerApprovedAt = "2026-07-17T15:00:00.000Z";
    expect(() => BridgeProjectSchema.parse(project)).toThrow(/providerApprovedBy/iu);

    project.requirements[index].providerApprovedBy = "Provider representative";
    project.requirements[index].providerApprovedAt = "not-a-date";
    expect(() => BridgeProjectSchema.parse(project)).toThrow(/providerApprovedAt/iu);
  });

  it.each([
    "userResponse",
    "implementationNarrative",
    "verificationNarrative",
    "validationNarrative",
  ] as const)("rejects provider-approved status with blank %s", (field) => {
    const project = createEmptyProject("Approval integrity", "Provider");
    const index = project.requirements.findIndex(({ ruleId }) => ruleId === "KSI-IAM-AAM");
    project.requirements[index] = {
      ...requirementDraft(),
      providerApprovedBy: "Provider representative",
      providerApprovedAt: "2026-07-17T15:00:00.000Z",
      [field]: "   ",
    };

    expect(() => BridgeProjectSchema.parse(project)).toThrow(new RegExp(field, "iu"));
  });

  it("accepts provider approval only with complete core narratives and approval metadata", () => {
    const project = createEmptyProject("Approval integrity", "Provider");
    const index = project.requirements.findIndex(({ ruleId }) => ruleId === "KSI-IAM-AAM");
    project.requirements[index] = {
      ...requirementDraft(),
      providerApprovedBy: "Provider representative",
      providerApprovedAt: "2026-07-17T15:00:00.000Z",
    };

    expect(BridgeProjectSchema.parse(project).requirements[index]?.status).toBe(
      "approved_by_provider",
    );
  });
});
