import { createEmptyProject, type BridgeProject } from "../../project/src/model";

export const GENERATED_AT = "2026-07-17T15:00:00.000Z";

export function createDocumentProject(options: { sample?: boolean } = {}): BridgeProject {
  const project = createEmptyProject("Acme Class A preparation", "Acme Metrics");
  project.metadata.updatedAt = GENERATED_AT;
  project.metadata.isSample = options.sample ?? false;
  if (options.sample) project.metadata.watermark = "Fictional example — not for submission.";
  project.organization.website = "https://acme.example";
  project.organization.grcOwner = "Morgan Lee";
  project.organization.accountableExecutive = "Taylor Kim";
  project.organization.trustCenterUrl = "https://trust.acme.example";
  project.offering.name = "Acme Metrics Cloud";
  project.offering.acronym = "AMC";
  project.offering.description = "Hosted metrics and reporting for agency teams.";
  project.offering.serviceModels = ["SaaS"];
  project.offering.deploymentModel = "Public Cloud";
  project.offering.federalUseCase = "Agency operational metrics";
  project.offering.handlesFederalData = "yes";
  project.eligibility.result = {
    classification: "likely_fit_with_preparation",
    label: "Likely fit with preparation work",
    summary: "The service appears to be a plausible Class A candidate with open evidence work.",
    reasons: ["The product is a cloud service and the audited product appears aligned."],
    supportingAnswerIds: ["soc2_type_ii", "cloud_service", "product_match"],
    blockers: [],
    missingInformation: ["Confirm the bridge-letter period."],
    recommendedActions: [
      "Confirm report dates",
      "Collect account-management evidence",
      "Review the package with the provider approver",
    ],
    ruleRefs: ["FRC-CLA-ASF", "FRC-CSO-PKG"],
    findings: [],
    disclaimer: "This preparation result is not a FedRAMP determination.",
    evaluatedAt: GENERATED_AT,
  };
  project.soc2.confirmedType = "type_ii";
  project.soc2.issuer = "Fictional Assurance LLP";
  project.soc2.reportStart = "2025-07-01";
  project.soc2.reportEnd = "2026-06-30";
  project.soc2.reportDate = "2026-07-10";
  project.soc2.systemName = "Acme Metrics Cloud";
  project.soc2.trustServicesCriteria = ["Security", "Availability"];
  project.soc2.sourceReport = {
    fileName: "confidential-soc2.pdf",
    attachmentId: "att-soc2",
    sha256: "b".repeat(64),
  };
  project.soc2.controls.push({
    id: "CC-6.1",
    title: "Logical access",
    trustServicesCriteria: ["CC6.1"],
    reportPages: [41],
    auditorTest: "Inspected access reviews.",
    auditorResult: "No exception noted.",
    exceptionIds: [],
    excerpt: "Confidential SOC excerpt <script>alert('soc')</script>",
  });
  project.soc2.exceptions.push({
    id: "EX-1",
    title: "One late review",
    description: "One quarterly review was completed late.",
    materiality: "minor",
    pages: [72],
  });
  project.scope.summary =
    "Production application, identity, logging, and supporting cloud services.";
  project.scope.dataFlowSummary =
    "Federal customer data enters the application and is stored in the primary database.";
  project.scope.questions = [
    "Confirm whether the support tooling can access federal customer data.",
  ];
  project.scope.resources.push(
    {
      id: "res-app",
      name: "Production application",
      kind: "component",
      description: "Customer-facing application service.",
      environment: "Production",
      handlesFederalData: true,
      affectsCia: true,
      included: true,
      rationale: "Processes federal customer data.",
      needsTechnicalConfirmation: false,
    },
    {
      id: "res-vendor",
      name: "Example Cloud",
      kind: "third_party_cloud",
      description: "Hosts the production service.",
      handlesFederalData: true,
      affectsCia: true,
      included: true,
      rationale: "Provides hosting infrastructure.",
      needsTechnicalConfirmation: true,
    },
  );
  project.scope.relationships.push({
    id: "rel-1",
    fromId: "res-app",
    toId: "res-vendor",
    kind: "depends_on",
    description: "The application depends on the hosting provider.",
  });
  project.materials.push(
    {
      id: "mat-soc2",
      kind: "soc2_report",
      title: "SOC 2 Type II report",
      status: "present",
      rationale: "Confirmed locally by the provider.",
      attachmentId: "att-soc2",
    },
    {
      id: "mat-bridge",
      kind: "bridge_letter",
      title: "Bridge letter",
      status: "missing",
      rationale: "Confirm whether the report-to-application gap requires one.",
    },
  );
  Object.assign(
    project.requirements.find(({ ruleId }) => ruleId === "KSI-IAM-AAM")!,
    {
      status: "drafted",
      reviewStatus: "in_review",
      userResponse: "Central identity workflows manage workforce accounts.",
      implementationNarrative: "Joiner, mover, and leaver events trigger account updates.",
      verificationNarrative: "The identity team reviews a monthly lifecycle report.",
      validationNarrative: "A reviewer samples completed lifecycle events quarterly.",
      independentVerification: "Pending independent assessor planning.",
      independentValidation: "Pending independent assessor planning.",
      soc2ControlIds: ["CC-6.1"],
      soc2PageReferences: [41],
      evidenceIds: ["ev-1"],
      owner: "Identity engineering",
      dueDate: "2026-08-15",
      notes: "Internal owner note.",
      openQuestions: ["Confirm service-account coverage."],
      exceptions: [],
    },
  );
  Object.assign(
    project.requirements.find(({ ruleId }) => ruleId === "FRC-CSO-PKG")!,
    {
      status: "needs_information",
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
      owner: "GRC program lead",
      notes: "",
      openQuestions: ["Confirm provider contacts and package identifier."],
      exceptions: [],
    },
  );
  project.evidence.push({
    id: "ev-1",
    title: "Account lifecycle export",
    description: "Monthly report of account lifecycle events.",
    kind: "report",
    sourceSystem: "Identity platform",
    owner: "Identity engineering",
    collectedAt: "2026-07-12",
    relevantPeriod: "2026-06",
    reviewDate: "2026-10-12",
    relatedRequirementIds: ["KSI-IAM-AAM"],
    relatedSoc2ControlIds: ["CC-6.1"],
    sha256: "a".repeat(64),
    sensitivity: "confidential",
    notes: "Confidential reviewer note.",
    reviewStatus: "candidate",
    attachmentId: "att-evidence",
  });
  project.mappings.push({
    id: "map-1",
    soc2ControlId: "CC-6.1",
    reportPage: 41,
    excerpt: "Private mapping excerpt <script>alert('mapping')</script>",
    classARuleId: "KSI-IAM-AAM",
    coverage: "partially_covered",
    reason: "The control supports lifecycle governance but does not confirm automation.",
    gapDescription: "Confirm automated deprovisioning.",
    additionalEvidenceNeeded: "Identity workflow configuration and execution logs.",
    suggested: true,
    confirmed: true,
    reviewOutcome: "partial_support",
    reviewer: "Morgan Lee",
    reviewDate: "2026-07-15",
  });
  project.actions.push(
    {
      id: "act-1",
      origin: "provider",
      title: '=HYPERLINK("https://attacker.invalid","Review")',
      description: "Collect the account lifecycle configuration.",
      category: "missing_evidence",
      priority: "high",
      owner: "Identity engineering",
      dueDate: "2026-08-15",
      status: "open",
      sourceRefs: ["KSI-IAM-AAM"],
      nextRoute: "#/requirements/KSI-IAM-AAM",
    },
    {
      id: "act-2",
      origin: "provider",
      title: "Confirm bridge-letter period",
      description: "Ask the report issuer whether a bridge letter is needed.",
      category: "before_application_preparation",
      priority: "medium",
      owner: "GRC program lead",
      status: "in_progress",
      sourceRefs: ["mat-bridge"],
      nextRoute: "#/soc2-materials",
    },
  );
  project.advisorFlags = ["Scope treatment for the support tool needs expert review."];
  project.notes = "Private board note that must not enter an advisor handoff.";
  return project;
}

export const OFFICIAL_OPTIONS = {
  certificationPackageOverview: {
    fedRampPackageId: "ACME-AMC",
    logoUrl: "https://acme.example/logo.png",
    website: "https://acme.example/product",
    deploymentModel: "Public Cloud" as const,
    securityContact: {
      contactType: "Security",
      contactName: "Security team",
      contactEmail: "security@acme.example",
    },
    salesContact: {
      contactType: "Sales",
      contactName: "Federal sales",
      contactEmail: "federal@acme.example",
    },
    trustCenterAuthenticationRequired: true,
    trustCenterAccessInstructions: "Request access from the security team.",
  },
  securityDecisionRecord: {
    certificationPackageOverviewUri:
      "https://acme.example/fedramp/certification-package-overview.json",
  },
  ongoingCertificationReport: {
    certificationPackageOverviewUri:
      "https://acme.example/fedramp/certification-package-overview.json",
    reportFrom: "2026-04-01",
    reportTo: "2026-06-30",
    planningHorizonThrough: "2026-09-30",
    certificationDataChanges: ["No material certification data changes during the period."],
    plannedChanges: ["Complete passwordless authentication rollout."],
    acceptedVulnerabilitiesSummary: "No provider-accepted vulnerabilities in this example period.",
    transformativeChanges: [],
    updatedRecommendations: [],
    activeAgencies: [],
    reportableIncidents: [],
  },
} as const;
