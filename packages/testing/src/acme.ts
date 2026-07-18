import {
  BridgeProjectSchema,
  createEmptyProject,
  evaluateEligibility,
  soc2MappingSupportsReuse,
  type AnswerValue,
  type BridgeProject,
  type EligibilityQuestionId,
  type RequirementWork,
} from "@class-a-bridge/project";
import { KSI_WORKFLOWS, RULE_GUIDANCE, RULE_REGISTRY } from "@class-a-bridge/rules";

export const SAMPLE_WATERMARK = "Fictional example — not for submission." as const;
const FIXED_DATE = "2026-07-15T14:00:00.000Z";
const FIT_REPORT_CONTENT = `<p>${SAMPLE_WATERMARK}</p><p>Needs expert review because the fictional scope includes a material carve-out and exception.</p>`;
const VALIDATION_REPORT_CONTENT = JSON.stringify({
  watermark: SAMPLE_WATERMARK,
  status: "invalid",
  issues: [{ field: "provider approval", message: "Missing fictional provider approval" }],
});
const SOC2_REUSE_REPORT_CONTENT = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>SOC 2 Reuse and Gap Report</title></head>
<body>
<p><strong>${SAMPLE_WATERMARK}</strong></p>
<h1>Acme Metrics SOC 2 Reuse and Gap Report</h1>
<p>System: Acme Metrics Cloud System. Fictional issuer: Fictional Independent Accounting Firm. Assessment period: July 1, 2025 through June 30, 2026. Proposed federal offering: Acme Metrics Cloud.</p>
<h2>Scope alignment</h2><p>The commercial and proposed federal application boundary appears similar, but the carved-out Fictional Cloud Host and privileged support path require review.</p>
<h2>Confirmed reusable controls</h2><p>Incident-response and change-management records were confirmed as supporting material. They do not automatically satisfy a Class A requirement.</p>
<h2>Partial and supporting-only mappings</h2><p>Change approval testing supports change governance, while access testing supplies operating context. Complete change-source logging and account automation still require FedRAMP-specific evidence.</p>
<h2>FedRAMP-specific gaps</h2><p>The team still needs current network-path validation, final incident-report timing and delivery records, package-specific approval, and official JSON validation.</p>
<h2>Scope and period mismatches</h2><p>The hosting-provider carve-out affects scope reuse. A prior-period independent assessment does not align with the confirmed report period.</p>
<h2>Auditor exceptions and carve-outs</h2><p>A delayed access removal affects reuse until remediation is reviewed. The carved-out host requires complementary-control and boundary confirmation.</p>
<h2>Complementary controls</h2><p>Customers approve administrators and review access quarterly. The host's complementary privileged-access control remains a provider representation requiring confirmation.</p>
<h2>Rejected mappings</h2><p>A keyword-only relationship between change management and passwordless authentication was rejected because the tested control objective was not substantively relevant.</p>
<h2>Requirements without confirmed support</h2><p>Network restriction has a strong unconfirmed candidate. Vulnerability detection and several package-specific requirements have no confirmed SOC 2 support.</p>
<h2>Evidence and follow-up</h2><p>Evidence candidates are linked by identifier. Technical owners must confirm network coverage, identity automation, report timing, and hosting scope. The accountable executive must approve final provider representations.</p>
<h2>Expert-review items</h2><p>Review the access exception, carved-out host, prior-period assessment, and any use of the official upstream cross-reference inconsistency.</p>
<h2>Mapping provenance</h2><p>Each record identifies the SOC 2 control, report page, Class A rule, review outcome, reviewer, review date, and related evidence candidate.</p>
<p>Reviewer: Taylor Morgan. Review date: July 15, 2026.</p>
<p>This report organizes preparation work only. It does not determine eligibility, certify the provider, establish evidence sufficiency, or replace provider, assessor, agency, or qualified-advisor review.</p>
<p><strong>${SAMPLE_WATERMARK}</strong></p>
</body></html>`;

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

const SAMPLE_MAPPINGS: BridgeProject["mappings"] = [
  {
    id: "map-change-partial",
    soc2ControlId: "ACME-CC8.1",
    reportPage: 70,
    excerpt: "Fictional change approvals and tests were sampled.",
    classARuleId: "KSI-CMT-LMC",
    coverage: "partially_covered",
    reason:
      "The sampled control supports change governance, but it does not establish that every deployment, emergency change, direct console change, and infrastructure change is logged.",
    gapDescription: "Reconcile every production change source to approval and audit logging.",
    additionalEvidenceNeeded:
      "Current configuration, deployment-to-ticket reconciliation, and a dated audit-log sample.",
    suggested: true,
    confirmed: true,
    suggestionLevel: "strong_candidate",
    suggestionSource: "deterministic_playbook",
    playbookContentVersion: "2026.07.18-beta.1",
    matchedCriteria: ["CC8.1"],
    matchedKeywords: ["change", "deployment"],
    suggestionReasons: [
      "CC8.1 and the control's change-approval language match the reviewed change-management playbook.",
    ],
    scopeAlignment: "aligned",
    periodAlignment: "aligned",
    testResultStatus: "no_exception_reported",
    exceptionStatus: "no_exception_reported",
    missingInformation: ["Confirm coverage for emergency and direct changes."],
    conflicts: [],
    evidenceIds: ["evidence-change-sample"],
    reviewOutcome: "partial_support",
    reviewer: "Taylor Morgan",
    reviewDate: "2026-07-15",
  },
  {
    id: "map-incident-support",
    soc2ControlId: "ACME-CC7.2",
    reportPage: 61,
    excerpt: "Fictional incident alerts and response records were sampled without exception.",
    classARuleId: "KSI-INR-RIR",
    coverage: "likely_covered",
    reason:
      "The tested monitoring and incident records support procedure review, while the federal reporting path and open exercise actions still need confirmation.",
    gapDescription:
      "Confirm FedRAMP recipients, deadlines, third-party dependencies, and corrective-action closure.",
    additionalEvidenceNeeded:
      "Current incident procedure, exercise review, and tracked improvement record.",
    suggested: true,
    confirmed: true,
    suggestionLevel: "possible_candidate",
    suggestionSource: "deterministic_playbook",
    playbookContentVersion: "2026.07.18-beta.1",
    matchedCriteria: ["CC7.2"],
    matchedKeywords: ["incident", "monitoring"],
    suggestionReasons: [
      "The control contains incident-monitoring evidence relevant to procedure review.",
    ],
    scopeAlignment: "aligned",
    periodAlignment: "aligned",
    testResultStatus: "no_exception_reported",
    exceptionStatus: "no_exception_reported",
    missingInformation: ["Confirm the federal incident-reporting path."],
    conflicts: [],
    evidenceIds: ["evidence-ir-exercise"],
    reviewOutcome: "confirmed_supporting_material",
    reviewer: "Taylor Morgan",
    reviewDate: "2026-07-15",
  },
  {
    id: "map-access-exception",
    soc2ControlId: "ACME-CC6.1",
    reportPage: 42,
    excerpt: "A fictional delayed access removal affected one tested item.",
    classARuleId: "KSI-IAM-AAM",
    coverage: "needs_human_review",
    reason:
      "The lifecycle test is relevant, but the auditor exception and incomplete automation evidence affect reuse.",
    gapDescription: "Review remediation and identify every manual account-lifecycle path.",
    additionalEvidenceNeeded:
      "Remediation evidence, automation coverage, and current exception handling records.",
    suggested: true,
    confirmed: true,
    suggestionLevel: "expert_review_suggested",
    suggestionSource: "deterministic_playbook",
    playbookContentVersion: "2026.07.18-beta.1",
    matchedCriteria: ["CC6.1", "CC6.2"],
    matchedKeywords: ["account", "access"],
    suggestionReasons: ["The control is relevant, but a recorded exception affects reliance."],
    scopeAlignment: "aligned",
    periodAlignment: "aligned",
    testResultStatus: "exception_reported",
    exceptionStatus: "exception_reported",
    missingInformation: ["Confirm remediation effectiveness."],
    conflicts: ["An auditor exception affects this reuse candidate."],
    evidenceIds: ["evidence-access-review"],
    reviewOutcome: "exception_affects_reuse",
    reviewer: "Taylor Morgan",
    reviewDate: "2026-07-15",
  },
  {
    id: "map-final-report-gap",
    soc2ControlId: "ACME-CC7.2",
    reportPage: 61,
    excerpt:
      "The SOC 2 test sampled response records but did not test FedRAMP final-report delivery.",
    classARuleId: "IEC-CSO-FIR",
    coverage: "fedramp_specific_work_required",
    reason:
      "Incident operating evidence may support the narrative but does not establish the Class A final-report content, recipients, or timing.",
    gapDescription: "Create and validate the FedRAMP-specific final incident-report workflow.",
    additionalEvidenceNeeded:
      "Final-report template, delivery record, timing calculation, approval, and JSON validation.",
    suggested: true,
    confirmed: true,
    suggestionLevel: "possible_candidate",
    suggestionSource: "deterministic_playbook",
    playbookContentVersion: "2026.07.18-beta.1",
    matchedCriteria: ["CC7.2"],
    matchedKeywords: ["incident"],
    suggestionReasons: [
      "The record supports incident handling but not the FedRAMP-specific artifact.",
    ],
    scopeAlignment: "aligned",
    periodAlignment: "aligned",
    testResultStatus: "no_exception_reported",
    exceptionStatus: "no_exception_reported",
    missingInformation: ["Confirm the delivery clock and recipients."],
    conflicts: [],
    evidenceIds: ["evidence-ir-exercise"],
    reviewOutcome: "fedramp_specific_work_required",
    reviewer: "Taylor Morgan",
    reviewDate: "2026-07-15",
  },
  {
    id: "map-host-scope-mismatch",
    soc2ControlId: "ACME-CC9.2",
    reportPage: 85,
    excerpt:
      "The fictional hosting service was identified but carved out of the auditor's testing.",
    classARuleId: "FRC-CLA-EAM",
    coverage: "scope_mismatch",
    reason:
      "A material in-boundary dependency was not included in the SOC 2 auditor's control testing.",
    gapDescription: "Resolve how the carved-out host is treated for the proposed federal offering.",
    additionalEvidenceNeeded:
      "Host assurance materials, complementary-control operation, and provider boundary rationale.",
    suggested: true,
    confirmed: true,
    suggestionLevel: "expert_review_suggested",
    suggestionSource: "deterministic_playbook",
    playbookContentVersion: "2026.07.18-beta.1",
    matchedCriteria: ["CC9.2"],
    matchedKeywords: ["subservice", "scope"],
    suggestionReasons: ["The carved-out service materially affects the proposed boundary."],
    scopeAlignment: "potential_mismatch",
    periodAlignment: "aligned",
    testResultStatus: "needs_review",
    exceptionStatus: "not_sure",
    missingInformation: ["Confirm the host's effective control coverage."],
    conflicts: ["The supporting service is carved out and may create a boundary mismatch."],
    evidenceIds: ["evidence-hosting-review"],
    reviewOutcome: "scope_mismatch",
    reviewer: "Taylor Morgan",
    reviewDate: "2026-07-15",
  },
  {
    id: "map-prior-period",
    soc2ControlId: "ACME-CC4.2-PRIOR",
    reportPage: 92,
    excerpt: "The independent assessment sample relates to the prior report period.",
    classARuleId: "FRC-CLA-IVV",
    coverage: "needs_human_review",
    reason:
      "The control pattern is relevant, but its test period does not align with the current report.",
    gapDescription: "Confirm current-period independent verification and validation coverage.",
    additionalEvidenceNeeded: "Current engagement record, test results, and assessment schedule.",
    suggested: true,
    confirmed: true,
    suggestionLevel: "potential_conflict",
    suggestionSource: "deterministic_playbook",
    playbookContentVersion: "2026.07.18-beta.1",
    matchedCriteria: ["CC4.2"],
    matchedKeywords: ["independent", "assessment"],
    suggestionReasons: ["The test period predates the confirmed SOC 2 report period."],
    scopeAlignment: "aligned",
    periodAlignment: "mismatch",
    testResultStatus: "no_exception_reported",
    exceptionStatus: "no_exception_reported",
    missingInformation: ["Add current-period assessment evidence."],
    conflicts: ["The control period does not match the confirmed SOC 2 report period."],
    evidenceIds: ["evidence-prior-assessment"],
    reviewOutcome: "period_mismatch",
    reviewer: "Taylor Morgan",
    reviewDate: "2026-07-15",
  },
  {
    id: "map-passwordless-rejected",
    soc2ControlId: "ACME-CC8.1",
    reportPage: 70,
    excerpt: "The change-management test does not establish passwordless authentication.",
    classARuleId: "KSI-IAM-APM",
    coverage: "no_relevant_mapping",
    reason:
      "A keyword-only suggestion was rejected because the tested control addresses production changes, not authentication methods.",
    gapDescription: "No reusable relationship was confirmed.",
    additionalEvidenceNeeded: "Identity-provider policy and passwordless enforcement evidence.",
    suggested: true,
    confirmed: true,
    suggestionLevel: "insufficient_information",
    suggestionSource: "deterministic_playbook",
    playbookContentVersion: "2026.07.18-beta.1",
    matchedCriteria: [],
    matchedKeywords: ["approval"],
    suggestionReasons: ["The initial keyword overlap was not substantively relevant."],
    scopeAlignment: "aligned",
    periodAlignment: "aligned",
    testResultStatus: "no_exception_reported",
    exceptionStatus: "no_exception_reported",
    missingInformation: [],
    conflicts: ["The control objective is unrelated to passwordless authentication."],
    evidenceIds: [],
    reviewOutcome: "rejected_mapping",
    reviewer: "Taylor Morgan",
    reviewDate: "2026-07-15",
  },
  {
    id: "map-host-expert-review",
    soc2ControlId: "ACME-CC9.2",
    reportPage: 85,
    excerpt:
      "Complementary host controls were described but not tested by the fictional SOC 2 auditor.",
    classARuleId: "FRC-CLA-IVV",
    coverage: "needs_human_review",
    reason:
      "Independent-assessment reuse depends on the treatment and evidence for the carved-out host.",
    gapDescription:
      "Qualified review is needed before relying on the host's separate assurance material.",
    additionalEvidenceNeeded:
      "Current host report, bridge letter if needed, and complementary-control evaluation.",
    suggested: true,
    confirmed: false,
    suggestionLevel: "expert_review_suggested",
    suggestionSource: "deterministic_playbook",
    playbookContentVersion: "2026.07.18-beta.1",
    matchedCriteria: ["CC9.2"],
    matchedKeywords: ["subservice", "carve-out"],
    suggestionReasons: ["The material service was carved out of the audited control testing."],
    scopeAlignment: "potential_mismatch",
    periodAlignment: "aligned",
    testResultStatus: "needs_review",
    exceptionStatus: "not_sure",
    missingInformation: ["Obtain and review the host's current assessment material."],
    conflicts: ["The service is carved out."],
    evidenceIds: ["evidence-hosting-review"],
    reviewOutcome: "needs_expert_review",
  },
] satisfies BridgeProject["mappings"];

const mappingContributesRequirementReference = (mapping: BridgeProject["mappings"][number]) =>
  soc2MappingSupportsReuse(mapping);

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
  const acceptedMappings = SAMPLE_MAPPINGS.filter(
    (mapping) => mapping.classARuleId === ruleId && mappingContributesRequirementReference(mapping),
  );
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
    soc2ControlIds: [...new Set(acceptedMappings.map(({ soc2ControlId }) => soc2ControlId))],
    soc2PageReferences: [...new Set(acceptedMappings.map(({ reportPage }) => reportPage))],
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
      logoUrl: "https://example.com/acme-metrics/fictional-logo.svg",
      deploymentModel: "Public Cloud",
      businessCategories: ["Analytics"],
      securityContact: {
        name: "Morgan Reyes",
        email: "security@example.com",
        phone: "202-555-0100",
      },
      salesContact: {
        name: "Avery Chen",
        email: "federal-sales@example.com",
        phone: "202-555-0101",
      },
      trustCenterAuthenticationRequired: true,
      trustCenterAccessInstructions:
        "Fictional reviewers request access from the provider contact.",
      nextOngoingCertificationReportDate: "2026-10-15",
    },
    securityDecisionRecord: {
      certificationPackageOverviewUri:
        "https://example.com/acme-metrics/package/certification-package-overview.json",
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
      certificationPackageOverviewUri:
        "https://example.com/acme-metrics/package/certification-package-overview.json",
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
        description:
          "The identity team approves, provisions, changes, and removes workforce access to the production service.",
        trustServicesCriteria: ["CC6.1", "CC6.2"],
        reportPages: [42, 43],
        reportPageRange: "42-43",
        auditorTest: "Inspected a fictional sample of workforce access changes.",
        auditorResult: "One delayed removal was noted and remediated.",
        exceptionIds: ["exception-access-removal"],
        excerpt:
          "Access requests require approval; a sampled terminated account was removed after the target window.",
        exceptionStatus: "exception_reported",
        exceptionDescription:
          "One sampled terminated-user account was disabled two days after the target window.",
        remediationStatus: "in_progress",
        reportPeriod: "July 1, 2025 through June 30, 2026",
        reportPeriodStart: "2025-07-01",
        reportPeriodEnd: "2026-06-30",
        frequency: "Event driven with quarterly review",
        owner: "Identity and IT",
        systemScope: "Acme Metrics Cloud",
        environment: "Production and corporate identity",
        treatment: "inclusive",
        complementaryUserEntityControl:
          "Customers approve administrators and review their access quarterly.",
        evidenceReferences: ["evidence-access-review"],
        scopeAlignment: "aligned",
        confirmationStatus: "confirmed",
        reviewer: "Taylor Morgan",
        reviewDate: "2026-07-15",
        notes: "The exception and remediation must be considered before this control is reused.",
        sourceSuggestions: [
          {
            field: "Auditor test result",
            suggestedValue: "One delayed removal was noted and remediated.",
            sourcePage: 43,
            sourceExcerpt: "One terminated-user account was disabled after the target window.",
            extractionBasis: "Deterministic exception-language and page-reference pattern",
            decision: "confirmed",
          },
        ],
      },
      {
        id: "ACME-CC7.2",
        title: "Security monitoring",
        description:
          "Security Operations monitors alerts and records incident triage and response activity.",
        trustServicesCriteria: ["CC7.2"],
        reportPages: [61, 62],
        reportPageRange: "61-62",
        auditorTest: "Inspected fictional alert and incident samples.",
        auditorResult: "No exceptions in the sample tested.",
        exceptionIds: [],
        excerpt:
          "Security alerts are monitored and incident response records are retained for review.",
        exceptionStatus: "no_exception_reported",
        remediationStatus: "not_required",
        reportPeriod: "July 1, 2025 through June 30, 2026",
        reportPeriodStart: "2025-07-01",
        reportPeriodEnd: "2026-06-30",
        frequency: "Continuous monitoring with event-driven response",
        owner: "Security Operations",
        systemScope: "Acme Metrics Cloud",
        environment: "Production",
        treatment: "inclusive",
        evidenceReferences: ["evidence-ir-exercise"],
        scopeAlignment: "aligned",
        confirmationStatus: "confirmed",
        reviewer: "Taylor Morgan",
        reviewDate: "2026-07-15",
        notes:
          "The SOC 2 test does not establish FedRAMP reportability, recipients, or final-report timing.",
      },
      {
        id: "ACME-CC8.1",
        title: "Change management",
        description:
          "Production changes require review, testing, approval, and controlled deployment.",
        trustServicesCriteria: ["CC8.1"],
        reportPages: [70],
        reportPageRange: "70",
        auditorTest: "Inspected fictional production changes for approval and testing.",
        auditorResult: "No exceptions in the sample tested.",
        exceptionIds: [],
        excerpt:
          "A sample of production change tickets was traced to approval, testing, and deployment records.",
        exceptionStatus: "no_exception_reported",
        remediationStatus: "not_required",
        reportPeriod: "July 1, 2025 through June 30, 2026",
        reportPeriodStart: "2025-07-01",
        reportPeriodEnd: "2026-06-30",
        frequency: "Per production change",
        owner: "Platform Engineering",
        systemScope: "Acme Metrics Cloud",
        environment: "Production",
        treatment: "inclusive",
        evidenceReferences: ["evidence-change-sample"],
        scopeAlignment: "aligned",
        confirmationStatus: "confirmed",
        reviewer: "Taylor Morgan",
        reviewDate: "2026-07-15",
        notes:
          "Confirm emergency changes, direct cloud changes, and infrastructure drift before reuse.",
      },
      {
        id: "ACME-CC6.6",
        title: "Network traffic restrictions",
        description:
          "Network traffic is restricted to approved ingress, egress, service, and administrative paths.",
        trustServicesCriteria: ["CC6.6", "CC6.7"],
        reportPages: [52, 53],
        reportPageRange: "52-53",
        auditorTest:
          "Inspected a fictional sample of network firewall changes and observed flow-log review.",
        auditorResult: "No exceptions were reported in the sample tested.",
        exceptionIds: [],
        excerpt:
          "Firewall rules restrict network traffic, and flow logs are reviewed for unexpected connections.",
        exceptionStatus: "no_exception_reported",
        remediationStatus: "not_required",
        reportPeriod: "July 1, 2025 through June 30, 2026",
        reportPeriodStart: "2025-07-01",
        reportPeriodEnd: "2026-06-30",
        frequency: "Per change with continuous flow logging",
        owner: "Cloud Platform",
        systemScope: "Acme Metrics Cloud",
        environment: "Production",
        treatment: "inclusive",
        evidenceReferences: ["evidence-network-rules"],
        scopeAlignment: "aligned",
        confirmationStatus: "confirmed",
        reviewer: "Taylor Morgan",
        reviewDate: "2026-07-15",
        notes: "This is a strong suggestion candidate, not a confirmed KSI-CNA-RNT mapping.",
      },
      {
        id: "ACME-CC4.2-PRIOR",
        title: "Prior-period independent assessment",
        description:
          "An independent assessment evaluated selected controls during the prior reporting period.",
        trustServicesCriteria: ["CC4.2"],
        reportPages: [92],
        reportPageRange: "92",
        auditorTest:
          "Inspected the fictional prior-period independent assessment plan and results.",
        auditorResult: "No exceptions were reported in the prior-period sample.",
        exceptionIds: [],
        excerpt:
          "The prior-period independent assessment covered July 1, 2024 through June 30, 2025.",
        exceptionStatus: "no_exception_reported",
        remediationStatus: "not_required",
        reportPeriod: "July 1, 2024 through June 30, 2025",
        reportPeriodStart: "2024-07-01",
        reportPeriodEnd: "2025-06-30",
        frequency: "Annual",
        owner: "GRC",
        systemScope: "Acme Metrics Cloud",
        environment: "Production",
        treatment: "inclusive",
        evidenceReferences: ["evidence-prior-assessment"],
        scopeAlignment: "aligned",
        confirmationStatus: "confirmed",
        reviewer: "Taylor Morgan",
        reviewDate: "2026-07-15",
        notes:
          "The period mismatch prevents the record from being treated as current-period support.",
      },
      {
        id: "ACME-CC9.2",
        title: "Subservice organization oversight",
        description:
          "The provider identifies material subservice organizations and reviews available assurance information.",
        trustServicesCriteria: ["CC9.2"],
        reportPages: [85, 86],
        reportPageRange: "85-86",
        auditorTest:
          "Inspected vendor-review records; the fictional host's controls were carved out of the examination.",
        auditorResult:
          "The provider oversight control was tested without exception; host controls were not tested.",
        exceptionIds: [],
        excerpt:
          "Fictional Cloud Host is a material subservice organization treated using the carve-out method.",
        exceptionStatus: "not_sure",
        remediationStatus: "not_sure",
        reportPeriod: "July 1, 2025 through June 30, 2026",
        reportPeriodStart: "2025-07-01",
        reportPeriodEnd: "2026-06-30",
        frequency: "Annual and on material change",
        owner: "Vendor Risk and Cloud Platform",
        systemScope: "Fictional Cloud Host supporting Acme Metrics Cloud",
        environment: "Production hosting",
        subserviceOrganization: "Fictional Cloud Host",
        treatment: "carve_out",
        complementarySubserviceOrganizationControl:
          "The fictional host restricts and reviews privileged infrastructure access.",
        evidenceReferences: ["evidence-hosting-review"],
        scopeAlignment: "potential_mismatch",
        confirmationStatus: "confirmed",
        reviewer: "Taylor Morgan",
        reviewDate: "2026-07-15",
        notes: "Carve-out treatment requires separate assurance and technical boundary review.",
      },
      {
        id: "ACME-CC7.1",
        title: "Vulnerability detection coverage",
        description:
          "Automated scanners identify vulnerabilities in application code, dependencies, and exposed services.",
        trustServicesCriteria: ["CC7.1"],
        reportPages: [57],
        reportPageRange: "57",
        auditorTest: "Suggested: inspected scanner configuration and a sample of findings.",
        auditorResult: "Suggested value requires user confirmation.",
        exceptionIds: [],
        excerpt:
          "Automated vulnerability scans are performed against application components and exposed services.",
        exceptionStatus: "not_sure",
        remediationStatus: "not_sure",
        reportPeriod: "July 1, 2025 through June 30, 2026",
        reportPeriodStart: "2025-07-01",
        reportPeriodEnd: "2026-06-30",
        frequency: "Suggested: continuous and weekly",
        owner: "Product Security",
        systemScope: "Acme Metrics Cloud",
        environment: "Production and build pipeline",
        treatment: "inclusive",
        evidenceReferences: [],
        scopeAlignment: "not_sure",
        confirmationStatus: "unreviewed",
        notes:
          "This locally extracted control remains a suggestion and cannot be reused until confirmed.",
        sourceSuggestions: [
          {
            field: "Auditor test procedure",
            suggestedValue: "Inspected scanner configuration and a sample of findings.",
            sourcePage: 57,
            sourceExcerpt: "...inspected configuration and selected vulnerability findings...",
            extractionBasis: "Deterministic control-heading and test-procedure pattern",
            decision: "unreviewed",
          },
          {
            field: "Control frequency",
            suggestedValue: "Continuous and weekly",
            sourcePage: 57,
            sourceExcerpt: "...continuous dependency checks and weekly external scans...",
            extractionBasis: "Deterministic frequency-term pattern",
            decision: "unreviewed",
          },
        ],
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

  project.requirements = RULE_REGISTRY.map(({ id }, index) => requirementFor(id, index));
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
    {
      id: "evidence-network-rules",
      title: "Network rule and flow-log review",
      description:
        "Fictional firewall export and observed-traffic review retained as an evidence candidate.",
      kind: "report",
      sourceSystem: "Example cloud network console",
      owner: "Cloud Platform",
      collectedAt: "2026-07-11",
      relevantPeriod: "2026 Q2",
      reviewDate: "2026-10-11",
      relatedRequirementIds: ["KSI-CNA-RNT"],
      relatedSoc2ControlIds: ["ACME-CC6.6"],
      sha256: "5".repeat(64),
      sensitivity: "restricted",
      notes:
        "Evidence candidate only; the suggestion has not been confirmed as a substantive mapping.",
      reviewStatus: "candidate",
    },
    {
      id: "evidence-hosting-review",
      title: "Carved-out host assurance review",
      description:
        "Fictional vendor-review record identifying missing current host-assurance material.",
      kind: "report",
      sourceSystem: "Example vendor-risk register",
      owner: "Vendor Risk",
      collectedAt: "2026-07-01",
      relevantPeriod: "2026",
      reviewDate: "2026-08-01",
      relatedRequirementIds: ["FRC-CLA-EAM", "FRC-CLA-IVV"],
      relatedSoc2ControlIds: ["ACME-CC9.2"],
      sha256: "6".repeat(64),
      sensitivity: "confidential",
      notes:
        "Candidate shows the carve-out decision; it does not establish the host control's sufficiency.",
      reviewStatus: "needs_review",
    },
    {
      id: "evidence-prior-assessment",
      title: "Prior-period independent assessment index",
      description:
        "Fictional index of independent-assessment procedures from the previous report period.",
      kind: "external_reference",
      sourceSystem: "Local compliance register",
      owner: "GRC",
      collectedAt: "2025-07-10",
      relevantPeriod: "2024-07-01 through 2025-06-30",
      reviewDate: "2026-07-15",
      relatedRequirementIds: ["FRC-CLA-IVV"],
      relatedSoc2ControlIds: ["ACME-CC4.2-PRIOR"],
      sha256: "7".repeat(64),
      sensitivity: "confidential",
      notes:
        "Evidence candidate is period-mismatched and cannot establish current assessment coverage.",
      reviewStatus: "reviewed",
    },
  ];

  project.mappings = structuredClone(SAMPLE_MAPPINGS);

  project.actions = [
    {
      id: "action-host-scope",
      origin: "provider",
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
      origin: "provider",
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
      origin: "provider",
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
      origin: "provider",
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
    {
      id: "action-prior-period",
      origin: "provider",
      title: "Replace prior-period assessment support",
      description:
        "Collect and review current-period independent assessment material before relying on the proposed reuse relationship.",
      category: "technical_confirmation",
      priority: "high",
      owner: "GRC and assessment coordinator",
      dueDate: "2026-08-12",
      status: "open",
      sourceRefs: ["ACME-CC4.2-PRIOR", "FRC-CLA-IVV", "IVV-CSX-AIA"],
      nextRoute: "/soc2-reuse",
    },
    {
      id: "action-network-mapping",
      origin: "provider",
      title: "Review the network-restriction suggestion",
      description:
        "Confirm the control's full boundary coverage and decide whether it is supporting material for KSI-CNA-RNT.",
      category: "technical_confirmation",
      priority: "medium",
      owner: "Cloud Platform and Compliance",
      dueDate: "2026-08-15",
      status: "open",
      sourceRefs: ["ACME-CC6.6", "KSI-CNA-RNT"],
      nextRoute: "/soc2-reuse",
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
    {
      id: "output-soc2-reuse",
      kind: "soc2_reuse_gap_report",
      title: `SOC 2 Reuse and Gap Report — ${SAMPLE_WATERMARK}`,
      format: "html",
      generatedAt: FIXED_DATE,
      sha256: "db9ca1a2d24b2e4d5ea5f09ced1e75014cb6d5407311a85fe3455f5ff547cdd9",
      content: SOC2_REUSE_REPORT_CONTENT,
      validationStatus: "not_applicable",
      validationIssues: [],
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
    "A prior-period mapping conflicts with the current SOC 2 assessment period.",
    "The host-related mapping remains unresolved and needs expert scope review.",
    "Several generated narratives contain unresolved provider representations.",
  ];
  project.notes =
    "This workspace contains fictional demonstration data only and must not be used for submission.";

  return BridgeProjectSchema.parse(project);
}

export const ACME_METRICS_PROJECT = createAcmeMetricsProject();
