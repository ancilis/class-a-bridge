import { z } from "zod";

export const RULE_CATALOG_VERSION = "2026.07.14.01" as const;
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
    id: z.string(),
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
    id: z.string(),
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
    id: z.string(),
    title: z.string(),
    trustServicesCriteria: z.array(z.string()),
    reportPages: z.array(z.number().int().positive()),
    auditorTest: z.string(),
    auditorResult: z.string(),
    exceptionIds: z.array(z.string()),
    excerpt: z.string(),
  })
  .strict();

const Soc2ExceptionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    materiality: z.enum(["minor", "material", "not_sure"]),
    pages: z.array(z.number().int().positive()),
  })
  .strict();

const SourceReportSchema = z
  .object({
    fileName: z.string(),
    attachmentId: z.string(),
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
    id: z.string(),
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
    id: z.string(),
    fromId: z.string(),
    toId: z.string(),
    kind: z.enum(["sends_data", "authenticates", "logs_to", "deploys_to", "depends_on"]),
    description: z.string(),
  })
  .strict();

const MaterialSchema = z
  .object({
    id: z.string(),
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
    attachmentId: z.string().optional(),
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

const RequirementWorkSchema = z
  .object({
    ruleId: z.string(),
    status: RequirementStatusSchema,
    reviewStatus: z.enum(["unreviewed", "in_review", "changes_requested", "approved"]),
    userResponse: z.string(),
    implementationNarrative: z.string(),
    verificationNarrative: z.string(),
    validationNarrative: z.string(),
    independentVerification: z.string(),
    independentValidation: z.string(),
    soc2ControlIds: z.array(z.string()),
    soc2PageReferences: z.array(z.number().int().positive()),
    evidenceIds: z.array(z.string()),
    owner: z.string(),
    dueDate: z.string().optional(),
    notes: z.string(),
    openQuestions: z.array(z.string()),
    exceptions: z.array(z.string()),
    seniorOfficialAcceptance: z.string().optional(),
    providerApprovedBy: z.string().optional(),
    providerApprovedAt: z.string().optional(),
  })
  .strict();

const EvidenceSchema = z
  .object({
    id: z.string(),
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
    relatedRequirementIds: z.array(z.string()),
    relatedSoc2ControlIds: z.array(z.string()),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
    notes: z.string(),
    reviewStatus: z.enum(["candidate", "needs_review", "reviewed", "rejected"]),
    attachmentId: z.string().optional(),
    externalUrl: z.string().url().optional(),
  })
  .strict();

const MappingSchema = z
  .object({
    id: z.string(),
    soc2ControlId: z.string(),
    reportPage: z.number().int().positive(),
    excerpt: z.string(),
    classARuleId: z.string(),
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

export const ActionCategorySchema = z.enum([
  "eligibility_blockers",
  "scope_blockers",
  "before_application_preparation",
  "missing_implementation",
  "missing_evidence",
  "technical_confirmation",
  "executive_approval",
  "recommended_improvements",
  "optional_enhancements",
]);

const ActionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    category: ActionCategorySchema,
    priority: z.enum(["critical", "high", "medium", "low"]),
    owner: z.string(),
    dueDate: z.string().optional(),
    status: z.enum(["open", "in_progress", "blocked", "done"]),
    sourceRefs: z.array(z.string()),
    nextRoute: z.string(),
  })
  .strict();

const GeneratedOutputSchema = z
  .object({
    id: z.string(),
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
    id: z.string(),
    version: z.string(),
    createdAt: z.string().datetime(),
    providerApprover: z.string(),
    verificationDate: z.string(),
    validationDate: z.string(),
    projectHash: z.string().regex(/^[a-f0-9]{64}$/u),
    packageHash: z.string().regex(/^[a-f0-9]{64}$/u),
    freshnessStatus: z.enum(["fresh", "aging", "stale"]),
    unresolvedItems: z.array(z.string()),
    immutable: z.literal(true),
  })
  .strict();

export const BridgeProjectSchema = z
  .object({
    metadata: ProjectMetadataSchema,
    organization: OrganizationSchema,
    offering: OfferingSchema,
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
    advisorFlags: z.array(z.string()),
    notes: z.string(),
  })
  .strict();

export type BridgeProject = z.infer<typeof BridgeProjectSchema>;
export type EvidenceItem = z.infer<typeof EvidenceSchema>;
export type RequirementWork = z.infer<typeof RequirementWorkSchema>;

const id = () =>
  globalThis.crypto?.randomUUID?.() ?? `cab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
    requirements: [],
    evidence: [],
    mappings: [],
    actions: [],
    generatedOutputs: [],
    snapshots: [],
    advisorFlags: [],
    notes: "",
  });
}
