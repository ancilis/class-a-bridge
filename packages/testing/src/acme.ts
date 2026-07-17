import {
  BridgeProjectSchema,
  createEmptyProject,
  evaluateEligibility,
  type AnswerValue,
  type BridgeProject,
  type EligibilityQuestionId,
  type RequirementWork,
} from "@class-a-bridge/project";
import { KSI_WORKFLOWS, RULE_GUIDANCE, RULE_SELECTIONS } from "@class-a-bridge/rules";

export const SAMPLE_WATERMARK = "Fictional example — not for submission." as const;
const FIXED_DATE = "2026-07-15T14:00:00.000Z";
const FIT_REPORT_CONTENT = `<p>${SAMPLE_WATERMARK}</p><p>Needs expert review because the fictional scope includes a material carve-out and exception.</p>`;
const VALIDATION_REPORT_CONTENT = JSON.stringify({
  watermark: SAMPLE_WATERMARK,
  status: "invalid",
  issues: [{ field: "provider approval", message: "Missing fictional provider approval" }],
});

const answerValues: Record<EligibilityQuestionId, AnswerValue> = {
  soc2_type_ii: "yes",
  soc2_fresh: "yes",
  product_match: "yes",
  federal_differs: "no",
  carved_out: "yes",
  material_exceptions: "yes",
  cloud_service: "yes",
  federal_use_case: "yes",
};

const ksiIds = new Set(KSI_WORKFLOWS.map(({ ruleId }) => ruleId));
const evidenceByRule: Readonly<Record<string, readonly string[]>> = {
  "KSI-CMT-LMC": ["evidence-change-sample"],
  "KSI-IAM-AAM": ["evidence-access-review"],
  "KSI-IAM-APM": ["evidence-access-review"],
  "KSI-INR-RIR": ["evidence-ir-exercise"],
  "IEC-CSO-FIR": ["evidence-ir-exercise"],
  "KSI-CED-RAT": ["evidence-training"],
};
const soc2ByRule: Readonly<
  Record<string, { readonly ids: readonly string[]; readonly pages: readonly number[] }>
> = {
  "KSI-CMT-LMC": { ids: ["ACME-CC8.1"], pages: [70] },
  "KSI-IAM-AAM": { ids: ["ACME-CC6.1"], pages: [42] },
  "KSI-IAM-APM": { ids: ["ACME-CC6.1"], pages: [42] },
  "KSI-INR-RIR": { ids: ["ACME-CC7.2"], pages: [61] },
  "IEC-CSO-FIR": { ids: ["ACME-CC7.2"], pages: [61] },
};

function requirementFor(ruleId: string, index: number): RequirementWork {
  const isKsi = ksiIds.has(ruleId);
  const guidance = RULE_GUIDANCE.find((item) => item.ruleId === ruleId);
  const status: RequirementWork["status"] = [
    "complete_for_internal_review",
    "drafted",
    "evidence_missing",
    "needs_technical_confirmation",
    "needs_expert_review",
  ][index % 5] as RequirementWork["status"];
  return {
    ruleId,
    status,
    reviewStatus: status === "complete_for_internal_review" ? "in_review" : "unreviewed",
    userResponse: isKsi
      ? `Acme Metrics has documented a fictional operating approach for ${ruleId}.`
      : index < 6
        ? "A draft provider response has been prepared for internal review."
        : "The program owner still needs to confirm the operating record.",
    implementationNarrative: isKsi
      ? `Outcome and implementation: Acme Metrics uses a fictional, scoped process for ${ruleId}; the named owner reviews coverage and records exceptions.`
      : index < 6
        ? "The preparation owner maintains a dated record and connects it to the proposed federal offering."
        : "",
    verificationNarrative: isKsi
      ? "Verification: the accountable owner checks configuration and process coverage against the documented boundary."
      : "",
    validationNarrative: isKsi
      ? "Validation: a dated sample is inspected to confirm the fictional process operated as described."
      : "",
    independentVerification: isKsi
      ? "Independent review is planned with the annual assessment coordinator."
      : "",
    independentValidation: isKsi
      ? "The validation sample and reviewer independence remain to be confirmed."
      : "",
    soc2ControlIds: [...(soc2ByRule[ruleId]?.ids ?? [])],
    soc2PageReferences: [...(soc2ByRule[ruleId]?.pages ?? [])],
    evidenceIds: [...(evidenceByRule[ruleId] ?? [])],
    owner: guidance?.suggestedOwner ?? "FedRAMP program owner",
    notes:
      index === 4
        ? "Confirm that the fictional exception remediation covers the federal boundary."
        : "",
    openQuestions:
      status === "needs_technical_confirmation"
        ? ["Does the current sample cover every production environment?"]
        : [],
    exceptions:
      status === "needs_expert_review" ? ["Interpretation and scope need human review."] : [],
  };
}

function createAcmeMetricsProject(): BridgeProject {
  const project = createEmptyProject("Acme Metrics Class A preparation", "Acme Metrics");
  project.metadata.id = "sample-acme-metrics";
  project.metadata.createdAt = FIXED_DATE;
  project.metadata.updatedAt = FIXED_DATE;
  project.metadata.lastLocalSaveAt = FIXED_DATE;
  project.metadata.isSample = true;
  project.metadata.watermark = SAMPLE_WATERMARK;
  project.organization = {
    name: "Acme Metrics",
    website: "https://example.com/acme-metrics",
    accountableExecutive: "Jordan Lee, Chief Operating Officer",
    grcOwner: "Taylor Morgan, Compliance Manager",
    trustCenterUrl: "https://example.com/acme-metrics/trust",
    marketplaceStatus: "preparing",
  };
  project.offering = {
    name: "Acme Metrics Cloud",
    acronym: "AMC",
    description:
      "A fictional software-as-a-service platform for operational metrics and dashboards.",
    serviceModels: ["SaaS"],
    deploymentModel: "Provider-operated multi-tenant public cloud service",
    federalUseCase: "Federal program teams review non-classified operational service metrics.",
    handlesFederalData: "yes",
    website: "https://example.com/acme-metrics/cloud",
  };
  project.packageInputs = {
    certificationPackageOverview: {
      fedRampPackageId: "ACME-AMC-FICTIONAL",
      ueiNumber: "FICTIONAL123",
      website: "https://example.com/acme-metrics/cloud",
      deploymentModel: "Public Cloud",
      businessCategories: ["Data Analytics"],
      securityContact: {
        name: "Morgan Reyes",
        email: "security@example.com",
        phone: "+1-202-555-0100",
      },
      salesContact: {
        name: "Avery Chen",
        email: "federal-sales@example.com",
        phone: "+1-202-555-0101",
      },
      trustCenterAuthenticationRequired: true,
      trustCenterAccessInstructions:
        "Fictional reviewers request access from the provider contact.",
      nextOngoingCertificationReportDate: "2026-10-15",
    },
    securityDecisionRecord: {
      certificationPackageOverviewUri: "./certification-package-overview.json",
      portsAndProtocols: [
        {
          id: "port-https",
          serviceName: "HTTPS",
          portNumber: "443",
          transportProtocol: "TCP",
          encryption: "TLS 1.3",
          purpose: "Fictional customer and administrative web traffic.",
        },
      ],
    },
    ongoingCertificationReport: {
      certificationPackageOverviewUri: "./certification-package-overview.json",
      reportFrom: "2026-07-01",
      reportTo: "2026-09-30",
      planningHorizonThrough: "2027-03-31",
      certificationDataChanges: ["No fictional certification-data changes recorded."],
      plannedChanges: ["Review passwordless coverage for administrative recovery paths."],
      acceptedVulnerabilitiesSummary:
        "No fictional accepted vulnerabilities are included in this sample.",
      transformativeChanges: [],
      updatedRecommendations: ["Close the access-removal evidence gap."],
      activeAgencies: [],
    },
  };

  project.eligibility.answers = Object.entries(answerValues).map(([questionId, value]) => ({
    questionId: questionId as EligibilityQuestionId,
    value,
    answeredAt: FIXED_DATE,
  }));
  const result = evaluateEligibility(answerValues);
  result.evaluatedAt = FIXED_DATE;
  project.eligibility.result = result;
  project.eligibility.history = [structuredClone(result)];

  project.soc2 = {
    confirmedType: "type_ii",
    issuer: "Fictional Independent Accounting Firm",
    reportStart: "2025-07-01",
    reportEnd: "2026-06-30",
    reportDate: "2026-07-10",
    systemName: "Acme Metrics Cloud System",
    trustServicesCriteria: ["Security", "Availability", "Confidentiality"],
    subserviceOrganizations: ["Fictional Cloud Host", "Example Identity Provider"],
    treatment: "carve_out",
    complementaryUserEntityControls: [
      "Customers manage authorized users and review access quarterly.",
    ],
    bridgeLetterReference:
      "Not currently needed; freshness should be reassessed before application.",
    extractionCandidates: [
      {
        id: "extract-report-period",
        field: "Report period",
        value: "July 1, 2025–June 30, 2026",
        page: 4,
        snippet: "...fictional examination period from July 1, 2025 through June 30, 2026...",
        confidence: "high",
        detector: "Deterministic date-range pattern",
        decision: "confirmed",
      },
    ],
    controls: [
      {
        id: "ACME-CC6.1",
        title: "Logical access",
        trustServicesCriteria: ["CC6.1"],
        reportPages: [42, 43],
        auditorTest: "Inspected a fictional sample of workforce access changes.",
        auditorResult: "One delayed removal was noted and remediated.",
        exceptionIds: ["exception-access-removal"],
        excerpt: "Fictional control excerpt for demonstration only.",
      },
      {
        id: "ACME-CC7.2",
        title: "Security monitoring",
        trustServicesCriteria: ["CC7.2"],
        reportPages: [61, 62],
        auditorTest: "Inspected fictional alert and incident samples.",
        auditorResult: "No exceptions in the sample tested.",
        exceptionIds: [],
        excerpt: "Fictional monitoring excerpt for demonstration only.",
      },
      {
        id: "ACME-CC8.1",
        title: "Change management",
        trustServicesCriteria: ["CC8.1"],
        reportPages: [70],
        auditorTest: "Inspected fictional production changes for approval and testing.",
        auditorResult: "No exceptions in the sample tested.",
        exceptionIds: [],
        excerpt: "Fictional change-management excerpt for demonstration only.",
      },
    ],
    exceptions: [
      {
        id: "exception-access-removal",
        title: "Delayed access removal",
        description:
          "One fictional terminated-user account was disabled two days after the target window.",
        materiality: "not_sure",
        pages: [44],
      },
    ],
  };

  project.scope = {
    resources: [
      {
        id: "scope-production",
        name: "Production application",
        kind: "component",
        description: "Customer-facing application services",
        environment: "Production",
        handlesFederalData: true,
        affectsCia: true,
        included: true,
        rationale: "Processes customer requests and federal customer data.",
        needsTechnicalConfirmation: false,
      },
      {
        id: "scope-database",
        name: "Primary metrics database",
        kind: "data_store",
        description: "Stores customer metrics and configuration",
        environment: "Production",
        handlesFederalData: true,
        affectsCia: true,
        included: true,
        rationale: "Stores in-scope customer content.",
        needsTechnicalConfirmation: false,
      },
      {
        id: "scope-identity",
        name: "Workforce identity provider",
        kind: "identity",
        description: "Authenticates administrators",
        handlesFederalData: false,
        affectsCia: true,
        included: true,
        rationale: "Controls privileged access to the offering.",
        needsTechnicalConfirmation: true,
      },
      {
        id: "scope-cloud",
        name: "Fictional Cloud Host",
        kind: "third_party_cloud",
        description: "Hosts the production environment",
        handlesFederalData: true,
        affectsCia: true,
        included: true,
        rationale: "Material hosting dependency described using carve-out treatment.",
        needsTechnicalConfirmation: true,
      },
      {
        id: "scope-marketing",
        name: "Marketing website",
        kind: "endpoint",
        description: "Public website without product access",
        handlesFederalData: false,
        affectsCia: false,
        included: false,
        rationale: "Does not process or affect the cloud offering.",
        needsTechnicalConfirmation: false,
      },
    ],
    relationships: [
      {
        id: "rel-app-db",
        fromId: "scope-production",
        toId: "scope-database",
        kind: "sends_data",
        description: "Application reads and writes customer metrics.",
      },
      {
        id: "rel-id-app",
        fromId: "scope-identity",
        toId: "scope-production",
        kind: "authenticates",
        description: "Identity provider authenticates privileged operators.",
      },
      {
        id: "rel-app-cloud",
        fromId: "scope-production",
        toId: "scope-cloud",
        kind: "depends_on",
        description: "Production services run on the fictional host.",
      },
    ],
    summary:
      "The proposed boundary includes the Acme Metrics Cloud production application, customer data stores, privileged identity, monitoring, deployment, and material hosting dependencies.",
    dataFlowSummary:
      "Federal users send metrics over the customer endpoint; the application stores them in the primary database and sends operational events to in-scope logging.",
    questions: [
      "Does the SOC 2 carve-out description provide enough current coverage for the fictional cloud host?",
      "Are support tools able to affect confidentiality, integrity, or availability?",
    ],
    mismatchFindings: [
      "The federal data classification and support-access path need technical confirmation.",
    ],
  };

  project.materials = [
    {
      id: "material-soc2",
      kind: "soc2_report",
      title: "SOC 2 Type II report",
      status: "present",
      rationale: "Fictional report metadata was confirmed for the sample.",
      reviewDate: "2026-07-15",
    },
    {
      id: "material-bridge",
      kind: "bridge_letter",
      title: "Bridge or gap letter",
      status: "not_applicable",
      rationale: "Not currently needed; reassess against the planned application date.",
    },
    {
      id: "material-engagement",
      kind: "engagement_documentation",
      title: "Verified audit engagement documentation",
      status: "needs_confirmation",
      rationale: "Engagement documentation has not been reviewed.",
    },
    {
      id: "material-schedule",
      kind: "upcoming_report_schedule",
      title: "Upcoming report schedule",
      status: "present",
      rationale: "Next fictional assessment fieldwork is scheduled for June 2027.",
    },
    {
      id: "material-supplemental",
      kind: "supplemental_evidence",
      title: "Supplemental compliance evidence",
      status: "missing",
      rationale: "Current remediation evidence for the access exception is still needed.",
    },
  ];

  project.requirements = RULE_SELECTIONS.mandatory.map(requirementFor);
  project.evidence = [
    {
      id: "evidence-change-sample",
      title: "Production change sample",
      description: "Fictional exported tickets and deployment references.",
      kind: "csv",
      sourceSystem: "Example change tracker",
      owner: "Platform Engineering",
      collectedAt: "2026-07-08",
      relevantPeriod: "2026 Q2",
      reviewDate: "2026-10-08",
      relatedRequirementIds: ["KSI-CMT-LMC"],
      relatedSoc2ControlIds: ["ACME-CC8.1"],
      sha256: "1".repeat(64),
      sensitivity: "confidential",
      notes: "Evidence candidate; sufficiency has not been determined.",
      reviewStatus: "candidate",
    },
    {
      id: "evidence-access-review",
      title: "Quarterly access review",
      description: "Fictional identity review export with approver record.",
      kind: "report",
      sourceSystem: "Example identity provider",
      owner: "IT and Security",
      collectedAt: "2026-06-30",
      relevantPeriod: "2026 Q2",
      reviewDate: "2026-09-30",
      relatedRequirementIds: ["KSI-IAM-AAM", "KSI-IAM-APM"],
      relatedSoc2ControlIds: ["ACME-CC6.1"],
      sha256: "2".repeat(64),
      sensitivity: "restricted",
      notes: "Contains no real people or accounts.",
      reviewStatus: "needs_review",
    },
    {
      id: "evidence-ir-exercise",
      title: "Incident-response exercise record",
      description: "Fictional tabletop agenda and after-action tracker.",
      kind: "file",
      sourceSystem: "Local document",
      owner: "Security Operations",
      collectedAt: "2026-05-14",
      relevantPeriod: "2026",
      reviewDate: "2027-05-14",
      relatedRequirementIds: ["KSI-INR-RIR", "IEC-CSO-FIR"],
      relatedSoc2ControlIds: ["ACME-CC7.2"],
      sha256: "3".repeat(64),
      sensitivity: "internal",
      notes: "Evidence candidate pending owner review.",
      reviewStatus: "candidate",
    },
    {
      id: "evidence-training",
      title: "Training completion export",
      description: "Fictional annual security training completion report.",
      kind: "csv",
      sourceSystem: "Example learning system",
      owner: "People Operations",
      collectedAt: "2025-09-15",
      relevantPeriod: "2025",
      reviewDate: "2026-09-15",
      relatedRequirementIds: ["KSI-CED-RAT"],
      relatedSoc2ControlIds: [],
      sha256: "4".repeat(64),
      sensitivity: "confidential",
      notes: "Approaching review date.",
      reviewStatus: "candidate",
    },
  ];

  project.mappings = [
    {
      id: "map-change",
      soc2ControlId: "ACME-CC8.1",
      reportPage: 70,
      excerpt: "Fictional change approvals were sampled.",
      classARuleId: "KSI-CMT-LMC",
      coverage: "partially_covered",
      reason:
        "The SOC 2 test supports change governance but does not by itself establish all required logging outcomes.",
      gapDescription: "Confirm production log coverage and the current federal boundary.",
      additionalEvidenceNeeded: "Current configuration and a dated log sample.",
      suggested: true,
      confirmed: true,
      reviewer: "Taylor Morgan",
      reviewDate: "2026-07-15",
    },
    {
      id: "map-access",
      soc2ControlId: "ACME-CC6.1",
      reportPage: 42,
      excerpt: "Fictional access changes were sampled.",
      classARuleId: "KSI-IAM-AAM",
      coverage: "supporting_evidence_only",
      reason:
        "The report provides a candidate operating sample; automation and scope still need confirmation.",
      gapDescription: "Document joiner, mover, leaver automation and exception handling.",
      additionalEvidenceNeeded:
        "Identity configuration, workflow sample, and dormant-account review.",
      suggested: true,
      confirmed: false,
    },
  ];

  project.actions = [
    {
      id: "action-host-scope",
      title: "Confirm cloud-host scope treatment",
      description:
        "Resolve how the carved-out hosting provider supports the proposed Class A boundary.",
      category: "scope_blockers",
      priority: "critical",
      owner: "Compliance and Platform Engineering",
      dueDate: "2026-08-01",
      status: "in_progress",
      sourceRefs: ["FRC-CLA-EAM", "MAS-CSO-IIR"],
      nextRoute: "/scope",
    },
    {
      id: "action-access-remediation",
      title: "Add access-removal remediation evidence",
      description:
        "Collect a current candidate showing the delayed-removal exception was addressed.",
      category: "missing_evidence",
      priority: "high",
      owner: "IT and Security",
      dueDate: "2026-07-29",
      status: "open",
      sourceRefs: ["ACME-CC6.1", "KSI-IAM-AAM"],
      nextRoute: "/evidence",
    },
    {
      id: "action-exec-approval",
      title: "Confirm accountable executive approval path",
      description:
        "Record who approves provider representations and the final internal package snapshot.",
      category: "executive_approval",
      priority: "high",
      owner: "Chief Operating Officer",
      dueDate: "2026-08-08",
      status: "open",
      sourceRefs: ["FRC-CSO-PKG"],
      nextRoute: "/package",
    },
    {
      id: "action-training",
      title: "Refresh training evidence",
      description: "Collect the next completion export before the current record becomes stale.",
      category: "recommended_improvements",
      priority: "medium",
      owner: "People Operations",
      dueDate: "2026-09-01",
      status: "open",
      sourceRefs: ["KSI-CED-RAT"],
      nextRoute: "/requirements/KSI-CED-RAT",
    },
  ];
  project.generatedOutputs = [
    {
      id: "output-fit",
      kind: "preliminary_fit_assessment",
      title: `Preliminary fit assessment — ${SAMPLE_WATERMARK}`,
      format: "html",
      generatedAt: FIXED_DATE,
      sha256: "21c23ecd5b118e2a351e51eac8a019a30667f536843f0fff89874a449e27b6ad",
      content: FIT_REPORT_CONTENT,
      validationStatus: "not_applicable",
      validationIssues: [],
    },
    {
      id: "output-validation",
      kind: "json_validation_report",
      title: `JSON validation report — ${SAMPLE_WATERMARK}`,
      format: "json",
      generatedAt: FIXED_DATE,
      sha256: "bb0acb1efd613aa6a01baf042297f0f75c3fc6c4e1833d070e0a9ef6d3b9a953",
      content: VALIDATION_REPORT_CONTENT,
      validationStatus: "invalid",
      validationIssues: [
        {
          pointer: "/provider/approver",
          message: "Provider approval is required before final internal review.",
          route: "/package/finalize",
        },
      ],
    },
  ];
  project.approvals = [
    {
      id: "approval-public-information-draft",
      kind: "requirement",
      title: "Public-information narrative approved for internal package review",
      approver: "Jordan Lee",
      role: "Chief Operating Officer (fictional)",
      acceptedAt: FIXED_DATE,
      scope: "CDS-CSO-PUB draft representation only; not final package approval.",
      notes: "Fictional demonstration approval — not for submission.",
    },
  ];
  project.advisorFlags = [
    "The fictional SOC 2 scope uses carve-out treatment for a material hosting dependency.",
    "An access-control exception and its remediation need expert review.",
    "Several generated narratives contain unresolved provider representations.",
  ];
  project.notes =
    "This workspace contains fictional demonstration data only and must not be used for submission.";

  return BridgeProjectSchema.parse(project);
}

export const ACME_METRICS_PROJECT = createAcmeMetricsProject();
