import { describe, expect, it } from "vitest";

import { RULE_SELECTIONS } from "@class-a-bridge/rules";

import {
  BridgeProjectSchema,
  PROJECT_SCHEMA_VERSION,
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
      expect.objectContaining({
        schemaVersion: PROJECT_SCHEMA_VERSION,
        ruleCatalogVersion: "2026.07.14.01",
      }),
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

  it("parses legacy v1 SOC 2 controls and mappings without inventing review provenance", () => {
    const project = createEmptyProject("Legacy SOC 2 mapping", "Provider");
    project.soc2.controls.push({
      id: "SOC2-CC6.1",
      title: "Logical access",
      trustServicesCriteria: ["CC6.1"],
      reportPages: [42],
      auditorTest: "Inspected a sample of access changes.",
      auditorResult: "No exceptions noted.",
      exceptionIds: [],
      excerpt: "Access is approved before provisioning.",
    });
    project.mappings.push({
      id: "mapping-legacy",
      soc2ControlId: "SOC2-CC6.1",
      reportPage: 42,
      excerpt: "Access is approved before provisioning.",
      classARuleId: "KSI-IAM-AAM",
      coverage: "supporting_evidence_only",
      reason: "The sampled access control may provide supporting material.",
      gapDescription: "Automation coverage still needs confirmation.",
      additionalEvidenceNeeded: "Current identity configuration.",
      suggested: true,
      confirmed: false,
    });

    const parsed = BridgeProjectSchema.parse(project);
    expect(parsed.soc2.controls[0]).toEqual(project.soc2.controls[0]);
    expect(parsed.mappings[0]).toEqual(project.mappings[0]);
    expect(parsed.mappings[0]).not.toHaveProperty("suggestionLevel");
  });

  it("rejects unresolved SOC 2 control, exception, and evidence references", () => {
    const project = createEmptyProject("SOC 2 reference integrity", "Provider");
    project.soc2.controls.push({
      id: "SOC2-CC7.2",
      title: "Monitoring",
      trustServicesCriteria: ["CC7.2"],
      reportPages: [61],
      auditorTest: "Inspected monitoring alerts.",
      auditorResult: "No exceptions noted.",
      exceptionIds: ["missing-exception"],
      excerpt: "Alerts are investigated.",
      evidenceReferences: ["missing-evidence"],
    });
    project.mappings.push({
      id: "mapping-missing-control",
      soc2ControlId: "missing-control",
      reportPage: 61,
      excerpt: "Alerts are investigated.",
      classARuleId: "KSI-INR-RIR",
      coverage: "needs_human_review",
      reason: "The control reference must resolve before review.",
      gapDescription: "",
      additionalEvidenceNeeded: "",
      suggested: true,
      confirmed: false,
      evidenceIds: ["missing-evidence"],
    });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(
      /missing-exception|missing-evidence|missing-control/iu,
    );
  });

  it("rejects duplicate SOC 2 control-to-rule pairs even when mapping IDs differ", () => {
    const project = createEmptyProject("Duplicate mapping pair", "Provider");
    project.soc2.controls.push({
      id: "SOC2-CC8.1",
      title: "Change management",
      trustServicesCriteria: ["CC8.1"],
      reportPages: [70],
      auditorTest: "Inspected production changes.",
      auditorResult: "No exceptions noted.",
      exceptionIds: [],
      excerpt: "Production changes require review.",
    });
    const mapping = {
      id: "mapping-one",
      soc2ControlId: "SOC2-CC8.1",
      reportPage: 70,
      excerpt: "Production changes require review.",
      classARuleId: "KSI-CMT-LMC",
      coverage: "partially_covered" as const,
      reason: "Change review may support the logging-changes outcome.",
      gapDescription: "Confirm that every change source is logged.",
      additionalEvidenceNeeded: "Current change-log reconciliation.",
      suggested: true,
      confirmed: false,
    };
    project.mappings.push(mapping, { ...mapping, id: "mapping-two" });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/control-to-rule pair.*unique/iu);
  });

  it("requires complete review provenance for every confirmed mapping decision", () => {
    const project = createEmptyProject("Mapping provenance", "Provider");
    project.soc2.controls.push({
      id: "SOC2-CC8.1",
      title: "Change management",
      trustServicesCriteria: ["CC8.1"],
      reportPages: [70],
      auditorTest: "Inspected production changes.",
      auditorResult: "No exceptions noted.",
      exceptionIds: [],
      excerpt: "Production changes require review.",
    });
    project.mappings.push({
      id: "mapping-reviewed-without-provenance",
      soc2ControlId: "SOC2-CC8.1",
      reportPage: 70,
      excerpt: "Production changes require review.",
      classARuleId: "KSI-CMT-LMC",
      coverage: "no_relevant_mapping",
      reason: "A reviewer rejected this relationship.",
      gapDescription: "No support was established.",
      additionalEvidenceNeeded: "Current change records.",
      suggested: true,
      confirmed: true,
      reviewOutcome: "rejected_mapping",
    });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/reviewer|review date|provenance/iu);
  });

  it("rejects a reviewed mapping when its outcome and coverage disagree", () => {
    const project = createEmptyProject("Mapping invariant", "Provider");
    project.soc2.controls.push({
      id: "SOC2-CC6.1",
      title: "Access management",
      trustServicesCriteria: ["CC6.1"],
      reportPages: [12],
      auditorTest: "Inspected access reviews.",
      auditorResult: "No exceptions noted.",
      exceptionIds: [],
      excerpt: "Access is reviewed.",
    });
    project.mappings.push({
      id: "mapping-inconsistent-review",
      soc2ControlId: "SOC2-CC6.1",
      reportPage: 12,
      excerpt: "Access is reviewed.",
      classARuleId: "KSI-IAM-AAM",
      coverage: "no_relevant_mapping",
      reason: "Tampered imported review record.",
      gapDescription: "",
      additionalEvidenceNeeded: "",
      suggested: false,
      confirmed: true,
      reviewOutcome: "confirmed_supporting_material",
      reviewer: "Morgan Lee",
      reviewDate: "2026-07-18",
    });

    const result = BridgeProjectSchema.safeParse(project);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["mappings", 0, "coverage"],
          message: expect.stringMatching(/must match the recorded review outcome/iu),
        }),
      ]),
    );
  });

  it("rejects supporting mapping confirmation until the source control has a dated review", () => {
    const project = createEmptyProject("Control review invariant", "Provider");
    project.soc2.controls.push({
      id: "SOC2-CC6.1",
      title: "Access management",
      trustServicesCriteria: ["CC6.1"],
      reportPages: [12],
      auditorTest: "Inspected access reviews.",
      auditorResult: "No exceptions noted.",
      exceptionIds: [],
      excerpt: "Access is reviewed.",
      confirmationStatus: "unreviewed",
    });
    project.mappings.push({
      id: "mapping-with-unreviewed-control",
      soc2ControlId: "SOC2-CC6.1",
      reportPage: 12,
      excerpt: "Access is reviewed.",
      classARuleId: "KSI-IAM-AAM",
      coverage: "partially_covered",
      reason: "Potential support.",
      gapDescription: "",
      additionalEvidenceNeeded: "",
      suggested: false,
      confirmed: true,
      reviewOutcome: "partial_support",
      reviewer: "Morgan Lee",
      reviewDate: "2026-07-18",
    });

    expect(() => BridgeProjectSchema.parse(project)).toThrow(/control record.*dated review/iu);
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
      expect.objectContaining({ from: 0, to: PROJECT_SCHEMA_VERSION }),
    ]);
    expect(BridgeProjectSchema.parse(migrated)).toEqual(migrated);
  });

  it("migrates legacy v1 mappings without inventing reviewer provenance", () => {
    const legacy = structuredClone(
      createEmptyProject("Legacy v1 mapping", "Provider"),
    ) as unknown as {
      metadata: Omit<BridgeProject["metadata"], "schemaVersion"> & { schemaVersion: number };
      soc2: BridgeProject["soc2"];
      mappings: BridgeProject["mappings"];
    } & Omit<BridgeProject, "metadata" | "soc2" | "mappings">;
    legacy.metadata.schemaVersion = 1;
    legacy.soc2.controls.push({
      id: "SOC2-CC8.1",
      title: "Change management",
      trustServicesCriteria: ["CC8.1"],
      reportPages: [70],
      auditorTest: "Inspected changes.",
      auditorResult: "No exceptions noted.",
      exceptionIds: [],
      excerpt: "Production changes require review.",
    });
    legacy.mappings.push({
      id: "legacy-confirmed-mapping",
      soc2ControlId: "SOC2-CC8.1",
      reportPage: 70,
      excerpt: "Production changes require review.",
      classARuleId: "KSI-CMT-LMC",
      coverage: "partially_covered",
      reason: "Legacy mapping",
      gapDescription: "Re-review required.",
      additionalEvidenceNeeded: "Current evidence.",
      suggested: true,
      confirmed: true,
    });

    const migrated = migrateProject(legacy);

    expect(migrated.metadata.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(migrated.mappings[0]).toEqual(
      expect.objectContaining({ confirmed: false, reviewOutcome: "needs_expert_review" }),
    );
    expect(migrated.mappings[0]?.missingInformation).toContain(
      "Reconfirm this mapping after the project migration.",
    );
    expect(migrated.metadata.migrations).toContainEqual(
      expect.objectContaining({ from: 1, to: PROJECT_SCHEMA_VERSION }),
    );
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
