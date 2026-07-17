import { z } from "zod";

import { CATALOG_MANIFEST, RULE_REGISTRY, RULE_SELECTIONS } from "@class-a-bridge/rules";

export const RULE_CATALOG_VERSION = CATALOG_MANIFEST.catalogVersion;
export const PROJECT_SCHEMA_VERSION = 1 as const;

export const AnswerValueSchema = z.enum(["yes", "no", "not_sure"]);
export type AnswerValue = z.infer<typeof AnswerValueSchema>;

export const EligibilityQuestionIdSchema = z.enum([
  "soc2_type_ii",
  "soc2_fresh",
  "product_match",
  "federal_differs",
  "carved_out",
  "material_exceptions",
  "cloud_service",
  "federal_use_case",
]);
export type EligibilityQuestionId = z.infer<typeof EligibilityQuestionIdSchema>;

export const ClassificationSchema = z.enum([
  "likely_fit",
  "likely_fit_with_preparation",
  "needs_expert_review",
  "potential_scope_mismatch",
  "not_currently_eligible",
]);
export type EligibilityClassification = z.infer<typeof ClassificationSchema>;

export const EligibilityFindingSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    answerRefs: z.array(EligibilityQuestionIdSchema),
    ruleRefs: z.array(z.string().min(1)),
    method: z.enum(["deterministic", "suggestion"]),
    certainty: z.enum(["confirmed", "conditional", "uncertain"]),
    evidenceNeeded: z.array(z.string()),
    humanReview: z.boolean(),
  })
  .strict();

export const PreliminaryResultSchema = z
  .object({
    classification: ClassificationSchema,
    label: z.string().min(1),
    summary: z.string().min(1),
    reasons: z.array(z.string()),
    supportingAnswerIds: z.array(EligibilityQuestionIdSchema),
    blockers: z.array(z.string()),
    missingInformation: z.array(z.string()),
    recommendedActions: z.array(z.string()).length(3),
    ruleRefs: z.array(z.string()),
    findings: z.array(EligibilityFindingSchema),
    disclaimer: z.string().min(1),
    evaluatedAt: z.string().datetime(),
  })
  .strict();
export type PreliminaryResult = z.infer<typeof PreliminaryResultSchema>;

const MigrationSchema = z
  .object({
    id: z.string().min(1),
    from: z.number().int().nonnegative(),
    to: z.number().int().positive(),
    appliedAt: z.string().datetime(),
  })
  .strict();

const ProjectMetadataSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    ruleCatalogVersion: z.literal(RULE_CATALOG_VERSION),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    lastLocalSaveAt: z.string().datetime().optional(),
    isSample: z.boolean(),
    watermark: z.string().optional(),
    migrations: z.array(MigrationSchema),
  })
  .strict();

const OrganizationSchema = z
  .object({
    name: z.string(),
    website: z.string().url().optional(),
    accountableExecutive: z.string().optional(),
    grcOwner: z.string().optional(),
    trustCenterUrl: z.string().url().optional(),
    marketplaceStatus: z.enum(["not_started", "preparing", "listed", "not_sure"]),
  })
  .strict();

const OfferingSchema = z
  .object({
    name: z.string(),
    acronym: z.string().optional(),
    description: z.string(),
    serviceModels: z.array(z.enum(["SaaS", "PaaS", "IaaS"])),
    deploymentModel: z.string(),
    federalUseCase: z.string(),
    handlesFederalData: z.enum(["yes", "no", "not_sure"]),
    website: z.string().url().optional(),
  })
  .strict();

const PackageContactSchema = z
  .object({ name: z.string(), email: z.string(), phone: z.string() })
  .strict();

const PackageInputsSchema = z
  .object({
    certificationPackageOverview: z
      .object({
        fedRampPackageId: z.string(),
        ueiNumber: z.string(),
        website: z.string(),
        logoUrl: z.string().default(""),
        deploymentModel: z.enum([
          "",
          "Public Cloud",
          "Government-Only Cloud",
          "Hybrid Cloud",
          "Community Cloud",
          "Government Community Cloud",
        ]),
        businessCategories: z.array(z.string()),
        securityContact: PackageContactSchema,
        salesContact: PackageContactSchema,
        trustCenterAuthenticationRequired: z.boolean(),
        trustCenterAccessInstructions: z.string(),
        nextOngoingCertificationReportDate: z.string(),
      })
      .strict(),
    securityDecisionRecord: z
      .object({
        certificationPackageOverviewUri: z.string(),
        portsAndProtocols: z.array(
          z
            .object({
              id: z.string().min(1),
              serviceName: z.string(),
              portNumber: z.string(),
              transportProtocol: z.string(),
              encryption: z.string(),
              purpose: z.string(),
            })
            .strict(),
        ),
      })
      .strict(),
    ongoingCertificationReport: z
      .object({
        certificationPackageOverviewUri: z.string(),
        reportFrom: z.string(),
        reportTo: z.string(),
        planningHorizonThrough: z.string(),
        certificationDataChanges: z.array(z.string()),
        plannedChanges: z.array(z.string()),
        acceptedVulnerabilitiesSummary: z.string(),
        transformativeChanges: z.array(z.string()),
        updatedRecommendations: z.array(z.string()),
        activeAgencies: z.array(z.string()),
      })
      .strict(),
  })
  .strict();

const EligibilityAnswerSchema = z
  .object({
    questionId: EligibilityQuestionIdSchema,
    value: AnswerValueSchema,
    answeredAt: z.string().datetime(),
    note: z.string().optional(),
  })
  .strict();

const ExtractionCandidateSchema = z
  .object({
    id: z.string().min(1),
    field: z.string(),
    value: z.string(),
    page: z.number().int().positive(),
    snippet: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    detector: z.string(),
    decision: z.enum(["unreviewed", "confirmed", "edited", "ignored"]),
  })
  .strict();

const Soc2ControlSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    trustServicesCriteria: z.array(z.string()),
    reportPages: z.array(z.number().int().positive()),
    auditorTest: z.string(),
    auditorResult: z.string(),
    exceptionIds: z.array(z.string().min(1)),
    excerpt: z.string(),
  })
  .strict();

const Soc2ExceptionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string(),
    materiality: z.enum(["minor", "material", "not_sure"]),
    pages: z.array(z.number().int().positive()),
  })
  .strict();

const SourceReportSchema = z
  .object({
    fileName: z.string(),
    attachmentId: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();

const Soc2Schema = z
  .object({
    confirmedType: z.enum(["type_ii", "other", "not_sure"]),
    issuer: z.string(),
    reportStart: z.string().optional(),
    reportEnd: z.string().optional(),
    reportDate: z.string().optional(),
    systemName: z.string(),
    trustServicesCriteria: z.array(z.string()),
    subserviceOrganizations: z.array(z.string()),
    treatment: z.enum(["inclusive", "carve_out", "mixed", "not_sure"]),
    complementaryUserEntityControls: z.array(z.string()),
    bridgeLetterReference: z.string().optional(),
    sourceReport: SourceReportSchema.optional(),
    extractionCandidates: z.array(ExtractionCandidateSchema),
    controls: z.array(Soc2ControlSchema),
    exceptions: z.array(Soc2ExceptionSchema),
  })
  .strict();

const ScopeResourceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    kind: z.enum([
      "environment",
      "component",
      "data_store",
      "identity",
      "logging",
      "development",
      "security_tool",
      "endpoint",
      "third_party_cloud",
      "service_provider",
    ]),
    description: z.string(),
    environment: z.string().optional(),
    handlesFederalData: z.boolean(),
    affectsCia: z.boolean(),
    included: z.boolean(),
    rationale: z.string(),
    needsTechnicalConfirmation: z.boolean(),
  })
  .strict();

const ScopeRelationshipSchema = z
  .object({
    id: z.string().min(1),
    fromId: z.string().min(1),
    toId: z.string().min(1),
    kind: z.enum(["sends_data", "authenticates", "logs_to", "deploys_to", "depends_on"]),
    description: z.string(),
  })
  .strict();

const MaterialSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum([
      "soc2_report",
      "bridge_letter",
      "engagement_documentation",
      "upcoming_report_schedule",
      "supplemental_evidence",
    ]),
    title: z.string(),
    status: z.enum(["present", "missing", "expiring", "needs_confirmation", "not_applicable"]),
    rationale: z.string(),
    reviewDate: z.string().optional(),
    attachmentId: z.string().min(1).optional(),
  })
  .strict();

export const RequirementStatusSchema = z.enum([
  "not_started",
  "needs_information",
  "drafted",
  "evidence_missing",
  "needs_technical_confirmation",
  "needs_expert_review",
  "complete_for_internal_review",
  "approved_by_provider",
]);

const ProviderApprovalTimestampSchema = z.string().datetime({ offset: true });
const providerApprovalCoreFields = [
  "userResponse",
  "implementationNarrative",
  "verificationNarrative",
  "validationNarrative",
] as const;

type ProviderApprovalCandidate = {
  readonly status: string;
  readonly providerApprovedBy?: string | undefined;
  readonly providerApprovedAt?: string | undefined;
  readonly userResponse: string;
  readonly implementationNarrative: string;
  readonly verificationNarrative: string;
  readonly validationNarrative: string;
};

const hasProviderApprovalIntegrity = (requirement: ProviderApprovalCandidate): boolean =>
  requirement.status === "approved_by_provider" &&
  Boolean(requirement.providerApprovedBy?.trim()) &&
  ProviderApprovalTimestampSchema.safeParse(requirement.providerApprovedAt).success &&
  providerApprovalCoreFields.every((field) => requirement[field].trim().length > 0);

const RequirementWorkSchema = z
  .object({
    ruleId: z.string().min(1),
    status: RequirementStatusSchema,
    reviewStatus: z.enum(["unreviewed", "in_review", "changes_requested", "approved"]),
    userResponse: z.string(),
    implementationNarrative: z.string(),
    verificationNarrative: z.string(),
    validationNarrative: z.string(),
    independentVerification: z.string(),
    independentValidation: z.string(),
    soc2ControlIds: z.array(z.string().min(1)),
    soc2PageReferences: z.array(z.number().int().positive()),
    evidenceIds: z.array(z.string().min(1)),
    owner: z.string(),
    dueDate: z.string().optional(),
    notes: z.string(),
    openQuestions: z.array(z.string()),
    exceptions: z.array(z.string()),
    seniorOfficialAcceptance: z.string().optional(),
    providerApprovedBy: z.string().optional(),
    providerApprovedAt: ProviderApprovalTimestampSchema.optional(),
  })
  .strict()
  .superRefine((requirement, context) => {
    if (requirement.status !== "approved_by_provider") return;
    if (!requirement.providerApprovedBy?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["providerApprovedBy"],
        message: "providerApprovedBy is required for provider-approved status.",
      });
    }
    if (!ProviderApprovalTimestampSchema.safeParse(requirement.providerApprovedAt).success) {
      context.addIssue({
        code: "custom",
        path: ["providerApprovedAt"],
        message:
          "providerApprovedAt must be a valid ISO 8601 date-time for provider-approved status.",
      });
    }
    for (const field of providerApprovalCoreFields) {
      if (requirement[field].trim().length === 0) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} must be complete before provider approval.`,
        });
      }
    }
  });

const EvidenceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string(),
    kind: z.enum([
      "file",
      "screenshot",
      "report",
      "policy",
      "ticket",
      "csv",
      "url",
      "external_reference",
    ]),
    sourceSystem: z.string().optional(),
    owner: z.string(),
    collectedAt: z.string(),
    relevantPeriod: z.string().optional(),
    reviewDate: z.string().optional(),
    relatedRequirementIds: z.array(z.string().min(1)),
    relatedSoc2ControlIds: z.array(z.string().min(1)),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
    notes: z.string(),
    reviewStatus: z.enum(["candidate", "needs_review", "reviewed", "rejected"]),
    attachmentId: z.string().min(1).optional(),
    externalUrl: z.string().url().optional(),
  })
  .strict();

const MappingSchema = z
  .object({
    id: z.string().min(1),
    soc2ControlId: z.string().min(1),
    reportPage: z.number().int().positive(),
    excerpt: z.string(),
    classARuleId: z.string().min(1),
    coverage: z.enum([
      "likely_covered",
      "partially_covered",
      "supporting_evidence_only",
      "fedramp_specific_work_required",
      "scope_mismatch",
      "no_relevant_mapping",
      "needs_human_review",
    ]),
    reason: z.string(),
    gapDescription: z.string(),
    additionalEvidenceNeeded: z.string(),
    suggested: z.boolean(),
    confirmed: z.boolean(),
    reviewer: z.string().optional(),
    reviewDate: z.string().optional(),
  })
  .strict();

export const ACTION_CATEGORIES = [
  "eligibility_blockers",
  "scope_blockers",
  "before_application_preparation",
  "missing_implementation",
  "missing_evidence",
  "technical_confirmation",
  "executive_approval",
  "recommended_improvements",
  "optional_enhancements",
] as const;

export const ActionCategorySchema = z.enum(ACTION_CATEGORIES);

const ActionSchema = z
  .object({
    id: z.string().min(1),
    origin: z.enum(["generated", "provider"]),
    title: z.string(),
    description: z.string(),
    category: ActionCategorySchema,
    priority: z.enum(["critical", "high", "medium", "low"]),
    owner: z.string(),
    dueDate: z.string().optional(),
    status: z.enum(["open", "in_progress", "blocked", "done"]),
    sourceRefs: z.array(z.string().min(1)),
    nextRoute: z.string(),
  })
  .strict();

const GeneratedOutputSchema = z
  .object({
    id: z.string().min(1),
    kind: z.string(),
    title: z.string(),
    format: z.enum(["html", "json", "pdf", "docx", "csv", "zip"]),
    generatedAt: z.string().datetime(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    content: z.string().optional(),
    validationStatus: z.enum(["valid", "invalid", "not_applicable"]),
    validationIssues: z.array(
      z.object({ pointer: z.string(), message: z.string(), route: z.string() }).strict(),
    ),
  })
  .strict();

const SnapshotSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().refine((value) => value.trim().length > 0, "Snapshot version is required."),
    createdAt: z.string().datetime(),
    providerApprover: z
      .string()
      .refine((value) => value.trim().length > 0, "Snapshot provider approver is required."),
    verificationDate: z.iso.date(),
    validationDate: z.iso.date(),
    projectHash: z.string().regex(/^[a-f0-9]{64}$/u),
    packageHash: z.string().regex(/^[a-f0-9]{64}$/u),
    freshnessStatus: z.enum(["fresh", "aging", "stale", "needs_confirmation"]),
    unresolvedItems: z.array(z.string()),
    immutable: z.literal(true),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const snapshotDate = snapshot.createdAt.slice(0, 10);
    if (snapshot.verificationDate > snapshotDate) {
      context.addIssue({
        code: "custom",
        path: ["verificationDate"],
        message: "Verification date cannot be after the snapshot creation date.",
      });
    }
    if (snapshot.validationDate > snapshotDate) {
      context.addIssue({
        code: "custom",
        path: ["validationDate"],
        message: "Validation date cannot be after the snapshot creation date.",
      });
    }
  });

const ApprovalSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum([
      "requirement",
      "provider_representation",
      "senior_official",
      "final_internal_review",
    ]),
    title: z.string().min(1),
    approver: z.string().min(1),
    role: z.string().min(1),
    acceptedAt: z.string().datetime(),
    scope: z.string().min(1),
    notes: z.string(),
  })
  .strict();

type Snapshot = z.infer<typeof SnapshotSchema>;
type Approval = z.infer<typeof ApprovalSchema>;

const finalReviewScopeForSnapshot = (snapshot: Snapshot) =>
  `Immutable snapshot record: ${JSON.stringify({
    id: snapshot.id,
    version: snapshot.version,
    createdAt: snapshot.createdAt,
    providerApprover: snapshot.providerApprover,
    verificationDate: snapshot.verificationDate,
    validationDate: snapshot.validationDate,
    projectHash: snapshot.projectHash,
    packageHash: snapshot.packageHash,
    freshnessStatus: snapshot.freshnessStatus,
    unresolvedItems: snapshot.unresolvedItems,
    immutable: snapshot.immutable,
  })}`;

const finalReviewApprovalMatchesSnapshot = (approval: Approval, snapshot: Snapshot) =>
  approval.kind === "final_internal_review" &&
  approval.approver === snapshot.providerApprover &&
  approval.role === "Provider approver" &&
  approval.scope === finalReviewScopeForSnapshot(snapshot);

export const BridgeProjectSchema = z
  .object({
    metadata: ProjectMetadataSchema,
    organization: OrganizationSchema,
    offering: OfferingSchema,
    packageInputs: PackageInputsSchema,
    eligibility: z
      .object({
        answers: z.array(EligibilityAnswerSchema),
        result: PreliminaryResultSchema.optional(),
        history: z.array(PreliminaryResultSchema),
      })
      .strict(),
    soc2: Soc2Schema,
    scope: z
      .object({
        resources: z.array(ScopeResourceSchema),
        relationships: z.array(ScopeRelationshipSchema),
        summary: z.string(),
        dataFlowSummary: z.string(),
        questions: z.array(z.string()),
        mismatchFindings: z.array(z.string()),
      })
      .strict(),
    materials: z.array(MaterialSchema),
    requirements: z.array(RequirementWorkSchema),
    evidence: z.array(EvidenceSchema),
    mappings: z.array(MappingSchema),
    actions: z.array(ActionSchema),
    generatedOutputs: z.array(GeneratedOutputSchema),
    snapshots: z.array(SnapshotSchema),
    approvals: z.array(ApprovalSchema),
    advisorFlags: z.array(z.string()),
    notes: z.string(),
  })
  .strict()
  .superRefine((project, context) => {
    if (project.metadata.isSample && !project.metadata.watermark?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["metadata", "watermark"],
        message: "A fictional sample project requires a visible watermark.",
      });
    }

    const requireUnique = <Item>(
      items: readonly Item[],
      identifier: (item: Item) => string,
      path: readonly string[],
      label: string,
      field = "id",
    ) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        const value = identifier(item);
        if (seen.has(value)) {
          context.addIssue({
            code: "custom",
            path: [...path, index, field],
            message: `Each ${label} identifier must be unique within the project.`,
          });
        }
        seen.add(value);
      });
    };

    requireUnique(
      project.metadata.migrations,
      (item) => item.id,
      ["metadata", "migrations"],
      "migration",
    );
    requireUnique(
      project.packageInputs.securityDecisionRecord.portsAndProtocols,
      (item) => item.id,
      ["packageInputs", "securityDecisionRecord", "portsAndProtocols"],
      "port and protocol",
    );
    requireUnique(
      project.eligibility.answers,
      (item) => item.questionId,
      ["eligibility", "answers"],
      "eligibility answer",
      "questionId",
    );
    requireUnique(
      project.soc2.extractionCandidates,
      (item) => item.id,
      ["soc2", "extractionCandidates"],
      "extraction candidate",
    );
    requireUnique(project.soc2.controls, (item) => item.id, ["soc2", "controls"], "SOC 2 control");
    requireUnique(
      project.soc2.exceptions,
      (item) => item.id,
      ["soc2", "exceptions"],
      "SOC 2 exception",
    );
    requireUnique(
      project.scope.resources,
      (item) => item.id,
      ["scope", "resources"],
      "scope resource",
    );
    requireUnique(
      project.scope.relationships,
      (item) => item.id,
      ["scope", "relationships"],
      "scope relationship",
    );
    requireUnique(project.materials, (item) => item.id, ["materials"], "SOC 2 material");
    requireUnique(
      project.requirements,
      (item) => item.ruleId,
      ["requirements"],
      "requirement rule",
      "ruleId",
    );
    const catalogRuleIds = new Set(RULE_REGISTRY.map(({ id: ruleId }) => ruleId));
    project.requirements.forEach((requirement, index) => {
      if (!catalogRuleIds.has(requirement.ruleId)) {
        context.addIssue({
          code: "custom",
          path: ["requirements", index, "ruleId"],
          message: `${requirement.ruleId} is not present in the pinned rule catalog.`,
        });
      }
    });
    const requirementRuleIds = new Set(project.requirements.map(({ ruleId }) => ruleId));
    for (const mandatoryRuleId of RULE_SELECTIONS.mandatory) {
      if (!requirementRuleIds.has(mandatoryRuleId)) {
        context.addIssue({
          code: "custom",
          path: ["requirements"],
          message: `Mandatory Class A requirement ${mandatoryRuleId} is missing.`,
        });
      }
    }
    project.evidence.forEach((evidence, evidenceIndex) => {
      evidence.relatedRequirementIds.forEach((ruleId, referenceIndex) => {
        if (!requirementRuleIds.has(ruleId)) {
          context.addIssue({
            code: "custom",
            path: ["evidence", evidenceIndex, "relatedRequirementIds", referenceIndex],
            message: `Evidence requirement reference ${ruleId} does not resolve to a project requirement.`,
          });
        }
      });
    });
    project.mappings.forEach((mapping, index) => {
      if (!requirementRuleIds.has(mapping.classARuleId)) {
        context.addIssue({
          code: "custom",
          path: ["mappings", index, "classARuleId"],
          message: `Mapping requirement reference ${mapping.classARuleId} does not resolve to a project requirement.`,
        });
      }
    });
    requireUnique(project.evidence, (item) => item.id, ["evidence"], "evidence");
    requireUnique(project.mappings, (item) => item.id, ["mappings"], "SOC 2 mapping");
    requireUnique(project.actions, (item) => item.id, ["actions"], "action");
    requireUnique(project.snapshots, (item) => item.id, ["snapshots"], "snapshot");
    requireUnique(project.approvals, (item) => item.id, ["approvals"], "approval");
    const approvedSnapshotIds = new Set<string>();
    project.approvals.forEach((approval, index) => {
      if (approval.kind !== "final_internal_review") return;
      const matchingSnapshots = project.snapshots.filter((snapshot) =>
        finalReviewApprovalMatchesSnapshot(approval, snapshot),
      );
      if (matchingSnapshots.length !== 1) {
        context.addIssue({
          code: "custom",
          path: ["approvals", index, "scope"],
          message:
            "Final internal-review approval must bind one immutable snapshot and its entire canonical record.",
        });
        return;
      }
      const matchingSnapshot = matchingSnapshots[0]!;
      if (Date.parse(approval.acceptedAt) < Date.parse(matchingSnapshot.createdAt)) {
        context.addIssue({
          code: "custom",
          path: ["approvals", index, "acceptedAt"],
          message:
            "Final internal-review approval cannot be accepted before the immutable snapshot was created.",
        });
      }
      const snapshotId = matchingSnapshot.id;
      if (approvedSnapshotIds.has(snapshotId)) {
        context.addIssue({
          code: "custom",
          path: ["approvals", index, "scope"],
          message: "An immutable snapshot can have only one final internal-review approval.",
        });
      }
      approvedSnapshotIds.add(snapshotId);
    });

    const attachmentIds = new Set<string>();
    if (project.soc2.sourceReport) attachmentIds.add(project.soc2.sourceReport.attachmentId);
    for (const evidence of project.evidence) {
      if (evidence.attachmentId) attachmentIds.add(evidence.attachmentId);
    }
    for (const material of project.materials) {
      if (material.attachmentId) attachmentIds.add(material.attachmentId);
    }

    const outputIds = new Set<string>();
    const outputHashes = new Set<string>();
    project.generatedOutputs.forEach((output, index) => {
      if (outputIds.has(output.id)) {
        context.addIssue({
          code: "custom",
          path: ["generatedOutputs", index, "id"],
          message: "Each generated output identifier must be unique within the project.",
        });
      }
      if (attachmentIds.has(output.id)) {
        context.addIssue({
          code: "custom",
          path: ["generatedOutputs", index, "id"],
          message: "A generated output identifier cannot also identify a local attachment.",
        });
      }
      outputIds.add(output.id);
      outputHashes.add(output.sha256);
    });

    project.snapshots.forEach((snapshot, index) => {
      if (!outputHashes.has(snapshot.packageHash)) {
        context.addIssue({
          code: "custom",
          path: ["snapshots", index, "packageHash"],
          message:
            "Snapshot packageHash must match a generated output retained in the project record.",
        });
      }
    });
  });

export type BridgeProject = z.infer<typeof BridgeProjectSchema>;
export type EvidenceItem = z.infer<typeof EvidenceSchema>;
export type RequirementWork = z.infer<typeof RequirementWorkSchema>;

export function finalReviewApprovalScope(snapshot: BridgeProject["snapshots"][number]): string {
  return finalReviewScopeForSnapshot(snapshot);
}

export function isFinalReviewApprovalForSnapshot(
  approval: BridgeProject["approvals"][number],
  snapshot: BridgeProject["snapshots"][number],
): boolean {
  return finalReviewApprovalMatchesSnapshot(approval, snapshot);
}

/**
 * Returns true only when status and the provider's approval record support an
 * Implemented/provider-approved representation. Document generation calls this
 * defensively because a typed project can still be mutated after validation.
 */
export function isProviderApprovedRequirement(requirement: RequirementWork): boolean {
  return hasProviderApprovalIntegrity(requirement);
}

const id = () =>
  globalThis.crypto?.randomUUID?.() ?? `cab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const blankRequirement = (ruleId: string): RequirementWork => ({
  ruleId,
  status: "not_started",
  reviewStatus: "unreviewed",
  userResponse: "",
  implementationNarrative: "",
  verificationNarrative: "",
  validationNarrative: "",
  independentVerification: "",
  independentValidation: "",
  soc2ControlIds: [],
  soc2PageReferences: [],
  evidenceIds: [],
  owner: "FedRAMP program owner",
  notes: "",
  openQuestions: [],
  exceptions: [],
});

export function createEmptyProject(name: string, organizationName: string): BridgeProject {
  const now = new Date().toISOString();
  return BridgeProjectSchema.parse({
    metadata: {
      id: id(),
      name,
      schemaVersion: 1,
      ruleCatalogVersion: RULE_CATALOG_VERSION,
      createdAt: now,
      updatedAt: now,
      isSample: false,
      migrations: [],
    },
    organization: { name: organizationName, marketplaceStatus: "not_started" },
    offering: {
      name: "",
      description: "",
      serviceModels: [],
      deploymentModel: "",
      federalUseCase: "",
      handlesFederalData: "not_sure",
    },
    packageInputs: {
      certificationPackageOverview: {
        fedRampPackageId: "",
        ueiNumber: "",
        website: "",
        logoUrl: "",
        deploymentModel: "",
        businessCategories: [],
        securityContact: { name: "", email: "", phone: "" },
        salesContact: { name: "", email: "", phone: "" },
        trustCenterAuthenticationRequired: false,
        trustCenterAccessInstructions: "",
        nextOngoingCertificationReportDate: "",
      },
      securityDecisionRecord: {
        certificationPackageOverviewUri: "",
        portsAndProtocols: [],
      },
      ongoingCertificationReport: {
        certificationPackageOverviewUri: "",
        reportFrom: "",
        reportTo: "",
        planningHorizonThrough: "",
        certificationDataChanges: [],
        plannedChanges: [],
        acceptedVulnerabilitiesSummary: "",
        transformativeChanges: [],
        updatedRecommendations: [],
        activeAgencies: [],
      },
    },
    eligibility: { answers: [], history: [] },
    soc2: {
      confirmedType: "not_sure",
      issuer: "",
      systemName: "",
      trustServicesCriteria: [],
      subserviceOrganizations: [],
      treatment: "not_sure",
      complementaryUserEntityControls: [],
      extractionCandidates: [],
      controls: [],
      exceptions: [],
    },
    scope: {
      resources: [],
      relationships: [],
      summary: "",
      dataFlowSummary: "",
      questions: [],
      mismatchFindings: [],
    },
    materials: [],
    requirements: RULE_SELECTIONS.mandatory.map((ruleId) => blankRequirement(ruleId)),
    evidence: [],
    mappings: [],
    actions: [],
    generatedOutputs: [],
    snapshots: [],
    approvals: [],
    advisorFlags: [],
    notes: "",
  });
}
