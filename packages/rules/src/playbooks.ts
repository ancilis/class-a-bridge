import { CATALOG_MANIFEST, RULE_REGISTRY, type OfficialRule } from "./catalog";

export type PlaybookReviewStatus =
  | "Draft"
  | "Technical review complete"
  | "Compliance review complete"
  | "Claims review complete"
  | "Approved for release";

export type CriterionRelationship =
  "Commonly supporting" | "Context-dependent" | "Rarely sufficient by itself";

export interface TrustServicesCriterionHint {
  readonly id: string;
  readonly relationship: CriterionRelationship;
  readonly rationale: string;
}

export interface Soc2MappingPlaybook {
  readonly ruleId: string;
  readonly contentVersion: string;
  readonly contentReviewStatus: PlaybookReviewStatus;
  readonly reviewer: string | null;
  readonly reviewDate: string | null;
  readonly disclaimer: string;
  readonly requirementSummary: string;
  readonly intendedOutcome: string;
  readonly trustServicesCriteria: readonly TrustServicesCriterionHint[];
  readonly supportingControlPatterns: readonly string[];
  readonly insufficientControlPatterns: readonly string[];
  readonly whatSoc2MayEstablish: readonly string[];
  readonly whatSoc2UsuallyDoesNotEstablish: readonly string[];
  readonly scopeChecks: readonly string[];
  readonly auditPeriodChecks: readonly string[];
  readonly testResultChecks: readonly string[];
  readonly exceptionChecks: readonly string[];
  readonly carveOutChecks: readonly string[];
  readonly subserviceOrganizationChecks: readonly string[];
  readonly complementaryControlChecks: readonly string[];
  readonly commonReusableEvidence: readonly string[];
  readonly fedrampSpecificEvidenceNeeded: readonly string[];
  readonly implementationQuestions: readonly string[];
  readonly verificationQuestions: readonly string[];
  readonly validationQuestions: readonly string[];
  readonly commonWeakMappings: readonly string[];
  readonly strongMappingCharacteristics: readonly string[];
  readonly commonBlockers: readonly string[];
  readonly organizationalOwner: string;
  readonly technicalTeams: readonly string[];
  readonly expertReviewTriggers: readonly string[];
  readonly narrativeOutline: readonly string[];
  readonly officialSourceReferences: readonly string[];
  readonly keywords: readonly string[];
}

interface PlaybookProfile {
  readonly trustServicesCriteria: readonly TrustServicesCriterionHint[];
  readonly supportingControlPatterns: readonly string[];
  readonly insufficientControlPatterns: readonly string[];
  readonly whatSoc2MayEstablish: readonly string[];
  readonly whatSoc2UsuallyDoesNotEstablish: readonly string[];
  readonly commonReusableEvidence: readonly string[];
  readonly fedrampSpecificEvidenceNeeded: readonly string[];
  readonly technicalTeams: readonly string[];
  readonly keywords: readonly string[];
}

const criterion = (
  id: string,
  relationship: CriterionRelationship,
  rationale: string,
): TrustServicesCriterionHint => ({ id, relationship, rationale });

const profiles = {
  package: {
    trustServicesCriteria: [
      criterion(
        "CC2.1",
        "Context-dependent",
        "Communication controls may support ownership and distribution of current package information.",
      ),
      criterion(
        "CC4.1",
        "Rarely sufficient by itself",
        "Monitoring records may support review history but do not create the FedRAMP package artifact.",
      ),
    ],
    supportingControlPatterns: [
      "Document governance with named owners, review cadence, approval, versioning, and controlled distribution.",
    ],
    insufficientControlPatterns: [
      "A general policy-management control that does not identify the FedRAMP package, schema, approver, or update trigger.",
    ],
    whatSoc2MayEstablish: [
      "The organization maintains controlled documents, assigns owners, and reviews representations on a defined cadence.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "That the Class A package contains each FedRAMP-specific document and validates against the pinned official schemas.",
    ],
    commonReusableEvidence: [
      "Document inventory, approval history, review tickets, and version-control records.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "Package index, provider approval, rule/schema provenance, JSON validation results, and unresolved-items record.",
    ],
    technicalTeams: ["GRC", "Security architecture", "Application engineering"],
    keywords: ["package", "document", "approval", "schema", "version", "certification"],
  },
  scope: {
    trustServicesCriteria: [
      criterion(
        "CC3.2",
        "Commonly supporting",
        "Risk identification may document systems and dependencies.",
      ),
      criterion(
        "CC9.2",
        "Context-dependent",
        "Vendor-risk work may identify material subservice dependencies.",
      ),
    ],
    supportingControlPatterns: [
      "A maintained system inventory links services, environments, data stores, identities, logs, deployment systems, and third parties to the audited service.",
    ],
    insufficientControlPatterns: [
      "An asset inventory that omits data handling, security impact, federal offering differences, or carved-out providers.",
    ],
    whatSoc2MayEstablish: [
      "The audited system boundary, principal components, data categories, and subservice organizations.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "That the proposed federal offering has the same boundary or that every resource affecting federal data is included.",
    ],
    commonReusableEvidence: [
      "System description, asset inventory, vendor inventory, architecture narrative, and data-flow records.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "Class A cloud service offering inventory, federal-data impact rationale, explicit exclusions, and technical confirmation of boundary differences.",
    ],
    technicalTeams: ["Cloud platform", "Security architecture", "Data engineering"],
    keywords: ["inventory", "scope", "boundary", "asset", "resource", "data flow", "subservice"],
  },
  communications: {
    trustServicesCriteria: [
      criterion(
        "CC2.1",
        "Commonly supporting",
        "Communication controls may show assigned channels and owners.",
      ),
      criterion(
        "CC2.2",
        "Context-dependent",
        "Internal communication may support escalation and continuity.",
      ),
    ],
    supportingControlPatterns: [
      "A monitored security or customer communication channel has named coverage, escalation, continuity, and periodic delivery testing.",
    ],
    insufficientControlPatterns: [
      "A mailbox exists but has no monitored ownership, backup coverage, or delivery test.",
    ],
    whatSoc2MayEstablish: [
      "Communication responsibilities, escalation paths, and operation of shared channels.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "The FedRAMP-specific address, recipients, response windows, or trust-center access behavior.",
    ],
    commonReusableEvidence: [
      "Mailbox ownership, escalation procedure, delivery tests, trust-center access records, and communication logs.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "FedRAMP channel configuration, uninterrupted receipt test, access rules, and dated required-action response records.",
    ],
    technicalTeams: ["Security operations", "IT", "Customer trust"],
    keywords: ["email", "inbox", "communication", "trust center", "notification", "delivery"],
  },
  incident: {
    trustServicesCriteria: [
      criterion(
        "CC7.3",
        "Commonly supporting",
        "Incident evaluation controls may support triage and reportability decisions.",
      ),
      criterion(
        "CC7.4",
        "Commonly supporting",
        "Response controls may support notification and recovery records.",
      ),
      criterion(
        "CC7.5",
        "Context-dependent",
        "Recovery review may support final reporting and corrective actions.",
      ),
    ],
    supportingControlPatterns: [
      "Incident procedures define detection, severity, decision ownership, notifications, recovery, final reporting, and retained timelines.",
    ],
    insufficientControlPatterns: [
      "A generic incident policy with no federal reportability decision, recipient, deadline, or final-report artifact.",
    ],
    whatSoc2MayEstablish: [
      "Incident roles, triage, escalation, response testing, and operating records during the audit period.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "Class A reportability decisions, FedRAMP recipients, PAIN-based deadlines, or required JSON report content.",
    ],
    commonReusableEvidence: [
      "Incident plan, exercise report, incident ticket, timeline, communications log, and after-action review.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "FedRAMP reportability record, recipient matrix, deadline calculation, incident-report JSON, and final-report approval.",
    ],
    technicalTeams: ["Security operations", "Incident response", "Legal and privacy"],
    keywords: ["incident", "reportability", "notification", "recovery", "final report", "triage"],
  },
  vulnerability: {
    trustServicesCriteria: [
      criterion(
        "CC7.1",
        "Commonly supporting",
        "Detection controls may support vulnerability identification coverage.",
      ),
      criterion(
        "CC7.2",
        "Commonly supporting",
        "Monitoring controls may support review, prioritization, and response evidence.",
      ),
    ],
    supportingControlPatterns: [
      "Authenticated and external detection sources cover the in-scope service, feed tracked findings, and retain scan configuration and result history.",
    ],
    insufficientControlPatterns: [
      "A policy says vulnerabilities are scanned without proving coverage, cadence, exclusions, or finding disposition.",
    ],
    whatSoc2MayEstablish: [
      "Scanning tools, remediation workflow, severity model, exception process, and sampled operation.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "Class A detection completeness, persistent machine validation, required reporting windows, or federal scope alignment.",
    ],
    commonReusableEvidence: [
      "Scanner configuration, asset coverage, dated results, remediation tickets, exceptions, and SLA reports.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "Federal-boundary coverage reconciliation, detection completeness analysis, required metrics, and current unresolved finding rationale.",
    ],
    technicalTeams: ["Vulnerability management", "Cloud platform", "Product security"],
    keywords: ["vulnerability", "scan", "detection", "remediation", "finding", "coverage", "drift"],
  },
  monitoring: {
    trustServicesCriteria: [
      criterion(
        "CC4.1",
        "Commonly supporting",
        "Monitoring controls may support report production and review.",
      ),
      criterion(
        "CC7.2",
        "Context-dependent",
        "Security monitoring may supply inputs to ongoing certification records.",
      ),
    ],
    supportingControlPatterns: [
      "A dated operating report is produced from defined sources, reviewed, approved, and made available to authorized recipients.",
    ],
    insufficientControlPatterns: [
      "A dashboard exists without retained reports, next-report date, ownership, or review evidence.",
    ],
    whatSoc2MayEstablish: [
      "Monitoring cadence, review ownership, exception follow-up, and supporting source systems.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "That the Ongoing Certification Report contains each required FedRAMP field or remains available as represented.",
    ],
    commonReusableEvidence: [
      "Monitoring report, review meeting record, dashboard export, exception ticket, and publication log.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "Current or example Ongoing Certification Report, next-report date, schema validation, and availability record.",
    ],
    technicalTeams: ["Security operations", "GRC", "Platform observability"],
    keywords: ["ongoing", "monitoring", "report", "availability", "next report", "metric"],
  },
  assessment: {
    trustServicesCriteria: [
      criterion(
        "CC4.1",
        "Commonly supporting",
        "Monitoring may establish recurring evaluation and follow-up.",
      ),
      criterion(
        "CC4.2",
        "Commonly supporting",
        "Separate evaluations may support independent assessment governance.",
      ),
    ],
    supportingControlPatterns: [
      "A qualified independent party evaluates the defined framework scope, records procedures and results, and tracks exceptions to resolution.",
    ],
    insufficientControlPatterns: [
      "An internal control review is described as independent without qualifications, scope, procedures, or results.",
    ],
    whatSoc2MayEstablish: [
      "The audit firm, report period, tested controls, results, exceptions, and management response.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "That all Class A framework expectations are covered continuously or that future assessment timing is acceptable.",
    ],
    commonReusableEvidence: [
      "SOC 2 report metadata, engagement documentation, test results, exception log, and bridge letter.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "Framework-to-Class A coverage rationale, assessment schedule, freshness evidence, and unresolved independent-review gaps.",
    ],
    technicalTeams: ["GRC", "Internal audit", "Security engineering"],
    keywords: ["independent", "assessment", "audit", "verification", "validation", "test result"],
  },
  identity: {
    trustServicesCriteria: [
      criterion(
        "CC6.1",
        "Commonly supporting",
        "Logical access design may support authentication and authorization boundaries.",
      ),
      criterion(
        "CC6.2",
        "Commonly supporting",
        "Account lifecycle controls may support provisioning and removal.",
      ),
      criterion(
        "CC6.3",
        "Context-dependent",
        "Access modification controls may support role and privilege changes.",
      ),
    ],
    supportingControlPatterns: [
      "Identity lifecycle and authentication policies are technically enforced, cover workforce and service identities, and retain exception and review records.",
    ],
    insufficientControlPatterns: [
      "An annual access review alone, without joiner/mover/leaver automation, recovery controls, or enforcement evidence.",
    ],
    whatSoc2MayEstablish: [
      "Provisioning, authentication, privilege, termination, and periodic review controls operated during the audit period.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "Passwordless coverage, automation completeness, emergency-access handling, or all identities in the federal boundary.",
    ],
    commonReusableEvidence: [
      "Identity-provider policy, lifecycle workflow, access reviews, termination samples, authentication reports, and exception tickets.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "Coverage inventory, passwordless enforcement, nonhuman identity treatment, automation exceptions, and current validation sample.",
    ],
    technicalTeams: ["Identity engineering", "IT", "Cloud platform"],
    keywords: [
      "account",
      "identity",
      "provision",
      "deprovision",
      "passwordless",
      "authentication",
      "access",
    ],
  },
  change: {
    trustServicesCriteria: [
      criterion(
        "CC8.1",
        "Commonly supporting",
        "Change-management controls often provide the principal SOC 2 support.",
      ),
      criterion(
        "CC7.2",
        "Context-dependent",
        "Monitoring may support detection of unapproved or drifted changes.",
      ),
    ],
    supportingControlPatterns: [
      "Every production change source is logged, linked to approval and deployment, monitored after release, and reconciled for emergency and automated changes.",
    ],
    insufficientControlPatterns: [
      "A sampled ticket approval control that omits emergency changes, direct cloud changes, pipelines, or drift.",
    ],
    whatSoc2MayEstablish: [
      "Production changes require review, testing, approval, deployment control, and sampled operating evidence.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "That all change sources are captured or that reviewers can trace each deployed change back to an approved record.",
    ],
    commonReusableEvidence: [
      "Pull request, deployment log, change ticket, audit log, emergency-change record, and drift alert.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "Full change-source inventory, traceability reconciliation, monitoring coverage, and validation sample for the federal boundary.",
    ],
    technicalTeams: ["Platform engineering", "Software engineering", "Security engineering"],
    keywords: ["change", "deployment", "pull request", "audit log", "emergency changes", "drift"],
  },
  network: {
    trustServicesCriteria: [
      criterion(
        "CC6.6",
        "Commonly supporting",
        "Boundary protection controls may support ingress and egress restrictions.",
      ),
      criterion(
        "CC6.7",
        "Commonly supporting",
        "Data transmission controls may support permitted paths and protections.",
      ),
    ],
    supportingControlPatterns: [
      "Documented ingress, egress, administrative, and service paths are enforced by policy, reviewed, and validated against flow data.",
    ],
    insufficientControlPatterns: [
      "A firewall policy or diagram without current rules, default behavior, exceptions, or observed-traffic validation.",
    ],
    whatSoc2MayEstablish: [
      "Network segmentation, firewall change review, secure transmission, and sampled configuration operation.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "That every federal-boundary path is necessary, restricted, current, and validated against observed traffic.",
    ],
    commonReusableEvidence: [
      "Network diagram, firewall export, policy-as-code review, flow-log sample, and exception record.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "Permitted-path inventory, federal-boundary rules, default-deny analysis, egress treatment, and current validation.",
    ],
    technicalTeams: ["Network engineering", "Cloud platform", "Security engineering"],
    keywords: ["network", "traffic", "ingress", "egress", "firewall", "flow log", "restrict"],
  },
  training: {
    trustServicesCriteria: [
      criterion(
        "CC1.4",
        "Commonly supporting",
        "Competence controls may support role-based training assignments.",
      ),
      criterion(
        "CC2.2",
        "Context-dependent",
        "Internal communications may support curriculum and change notices.",
      ),
    ],
    supportingControlPatterns: [
      "Training is role-scoped, reviewed for completeness and currency, assigned, tracked, and escalated when overdue.",
    ],
    insufficientControlPatterns: [
      "An annual completion statistic without curriculum review, role coverage, exceptions, or follow-up.",
    ],
    whatSoc2MayEstablish: [
      "Training assignment, completion, overdue follow-up, and curriculum governance during the period.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "That all relevant training content and populations were reviewed for the Class A offering.",
    ],
    commonReusableEvidence: [
      "Curriculum approval, assignment rules, completion export, overdue tickets, and role matrix.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "Class A role/population reconciliation, content-review rationale, exceptions, and current validation sample.",
    ],
    technicalTeams: ["People operations", "Security awareness", "Engineering management"],
    keywords: ["training", "curriculum", "completion", "role", "overdue", "review"],
  },
  service: {
    trustServicesCriteria: [
      criterion(
        "CC2.1",
        "Commonly supporting",
        "Information-quality controls may support authoritative security documentation.",
      ),
      criterion(
        "CC2.3",
        "Context-dependent",
        "External communication may support customer-facing security information.",
      ),
    ],
    supportingControlPatterns: [
      "Authoritative security information has an owner, audience, publication path, review cadence, and change trigger.",
    ],
    insufficientControlPatterns: [
      "A collection of policies exists without current ownership, intended audience, distribution, or service scope.",
    ],
    whatSoc2MayEstablish: [
      "Security documentation is maintained, approved, communicated, and reviewed.",
    ],
    whatSoc2UsuallyDoesNotEstablish: [
      "That Class A reviewers and customers receive all current information needed to understand the federal offering.",
    ],
    commonReusableEvidence: [
      "Document register, trust-center publication, review record, customer notice, and ownership matrix.",
    ],
    fedrampSpecificEvidenceNeeded: [
      "Class A information inventory, audience mapping, federal-offering scope, and current publication evidence.",
    ],
    technicalTeams: ["GRC", "Customer trust", "Security architecture"],
    keywords: [
      "security information",
      "documentation",
      "publish",
      "customer",
      "trust center",
      "review",
    ],
  },
} satisfies Record<string, PlaybookProfile>;

type ProfileName = keyof typeof profiles;

const profileForRule = (id: string): ProfileName => {
  if (id === "MAS-CSO-IIR") return "scope";
  if (/^(AFC|CDS)-/u.test(id)) return "communications";
  if (id.startsWith("IEC-")) return "incident";
  if (/^(VDR|VER)-/u.test(id)) return "vulnerability";
  if (id.startsWith("CCM-")) return "monitoring";
  if (id.startsWith("IVV-")) return "assessment";
  if (/^KSI-IAM-/u.test(id)) return "identity";
  if (id === "KSI-CMT-LMC") return "change";
  if (id === "KSI-CNA-RNT") return "network";
  if (id === "KSI-CED-RAT") return "training";
  if (id === "KSI-INR-RIR") return "incident";
  if (id === "KSI-SVC-SIN") return "service";
  return "package";
};

const mandatoryOverrides: Record<
  string,
  { summary: string; outcome: string; specificGap: string; specificQuestion: string }
> = {
  "FRC-CSO-PKG": {
    summary:
      "Assemble the complete provider-owned Class A certification package and keep each representation reviewable.",
    outcome:
      "A reviewer can locate the scope, implementation, validation, assessment, and ongoing-report records without relying on an unsupported claim.",
    specificGap:
      "SOC 2 does not create the FedRAMP certification package structure or provider approval chain.",
    specificQuestion:
      "Who owns package completeness, versioning, unresolved items, and final provider approval?",
  },
  "FRC-CSO-JSN": {
    summary:
      "Supply machine-readable documents that validate against each applicable pinned FedRAMP JSON schema.",
    outcome:
      "Generated JSON is structurally valid, provenance-linked, and never labeled valid while schema errors remain.",
    specificGap:
      "SOC 2 testing rarely establishes FedRAMP JSON schema validity or field-level traceability.",
    specificQuestion:
      "Which application fields produce each JSON value and who resolves validation errors?",
  },
  "FRC-CSO-POP": {
    summary:
      "Record the provider's decision not to pursue both Rev5 Program Certification and 20x Program Certification for the same offering.",
    outcome:
      "The certification path and cloud service offering identity are explicit and provider-approved.",
    specificGap: "SOC 2 does not determine or approve a FedRAMP certification path.",
    specificQuestion:
      "Has an accountable executive confirmed the selected path for the exact offering?",
  },
  "MAS-CSO-IIR": {
    summary:
      "Identify every information resource likely to handle federal customer data or affect its confidentiality, integrity, or availability.",
    outcome:
      "The proposed federal boundary is complete enough for technical confirmation and exposes differences from the SOC 2 system.",
    specificGap:
      "A SOC 2 system description may omit resources relevant to the proposed federal use case or use a different materiality boundary.",
    specificQuestion:
      "Which resources or providers differ between the audited commercial service and the proposed federal offering?",
  },
  "CDS-CSO-PUB": {
    summary:
      "Identify certification information intended for public access and separate it from restricted or sensitive material.",
    outcome:
      "Publication decisions are deliberate, approved, current, and do not disclose protected project content.",
    specificGap:
      "SOC 2 distribution controls do not by themselves determine FedRAMP publication expectations.",
    specificQuestion:
      "Who approves public certification information and checks it for sensitive content?",
  },
  "CDS-CSO-UTC": {
    summary:
      "Use a trust center or equivalent controlled sharing method for current certification information.",
    outcome:
      "Authorized parties can obtain current materials while access and publication changes remain reviewable.",
    specificGap:
      "A SOC 2 report portal may not contain the Class A materials, freshness signals, or access behavior expected here.",
    specificQuestion:
      "How will the provider publish updates and revoke or preserve access when circumstances change?",
  },
  "CDS-UTC-AAD": {
    summary:
      "Document how agency access denial is handled without obscuring the provider's sharing responsibilities.",
    outcome:
      "Denial decisions have an owner, rationale, communication path, and retained review record.",
    specificGap:
      "Generic confidentiality controls usually do not establish the agency-specific denial workflow.",
    specificQuestion: "Who may deny access, on what basis, and how is the agency informed?",
  },
  "AFC-CSO-INB": {
    summary:
      "Maintain a monitored FedRAMP security inbox with accountable primary and backup coverage.",
    outcome:
      "FedRAMP security communications reach a staffed channel and enter a traceable response workflow.",
    specificGap:
      "A generic security mailbox does not prove the correct address, recipients, or FedRAMP escalation ownership.",
    specificQuestion:
      "Which people monitor the inbox during absence, turnover, and incident conditions?",
  },
  "AFC-CSO-RCV": {
    summary:
      "Demonstrate that the security inbox can receive required email without filtering, quota, routing, or continuity disruption.",
    outcome: "Delivery is periodically tested and failures create an owned corrective action.",
    specificGap:
      "SOC 2 email controls rarely test this specific external sender and continuity path.",
    specificQuestion:
      "When was end-to-end receipt last tested, including spam filtering and backup ownership?",
  },
  "AFC-CSO-CRA": {
    summary:
      "Track FedRAMP-required actions from receipt through accountable completion and retained response evidence.",
    outcome:
      "Each action has an owner, due date, response, approval, and unresolved-risk visibility.",
    specificGap:
      "General ticketing controls may not distinguish FedRAMP-required actions or preserve the provider representation.",
    specificQuestion:
      "How are required actions identified, prioritized, escalated, approved, and closed?",
  },
  "IEC-CSO-EFR": {
    summary:
      "Evaluate security events against FedRAMP reportability criteria and retain the decision basis.",
    outcome:
      "A qualified decision-maker can explain why an event was or was not reportable and which facts were still uncertain.",
    specificGap:
      "SOC 2 incident classification does not automatically establish FedRAMP reportability.",
    specificQuestion:
      "Who makes the reportability decision and how are ambiguous events escalated?",
  },
  "IEC-CSO-FIR": {
    summary:
      "Provide affected parties a final incident report after resolution and recovery, including final updates to previously reported information.",
    outcome:
      "The final incident report is approved and delivered within the applicable Class A three business days while preserving recipient and timing evidence.",
    specificGap:
      "SOC 2 may show incident closure but not the Class A final-report content, recipients, or three-business-day timing.",
    specificQuestion:
      "Who confirms recovery is complete, starts the three-business-day clock, approves the report, and records delivery?",
  },
  "VDR-CSO-DET": {
    summary:
      "Detect vulnerabilities across the complete cloud service offering using reviewable and current coverage.",
    outcome:
      "The provider can reconcile detection sources to in-scope resources and explain exclusions, blind spots, and stale results.",
    specificGap: "A SOC 2 scan sample may not prove complete, current Class A boundary coverage.",
    specificQuestion:
      "Which assets, code, images, dependencies, and exposed surfaces are covered by each detector?",
  },
  "CCM-OCR-AVL": {
    summary:
      "Make a real or representative Ongoing Certification Report available through the certification record.",
    outcome:
      "The report is current, authorized, locatable, and structurally consistent with the pinned schema where applicable.",
    specificGap:
      "SOC 2 monitoring reports do not automatically constitute the FedRAMP Ongoing Certification Report.",
    specificQuestion:
      "Where is the report published, who approves it, and how is continued availability verified?",
  },
  "CCM-OCR-NRD": {
    summary: "State and maintain the next expected Ongoing Certification Report date.",
    outcome:
      "The next-report date is owned, feasible, updated when circumstances change, and consistent across outputs.",
    specificGap:
      "SOC 2 audit cadence is not a substitute for the next Ongoing Certification Report date.",
    specificQuestion: "Who owns the date and what event requires it to be revised?",
  },
  "IVV-CSX-AIA": {
    summary:
      "Meet the underlying alternative security framework expectations through persistent independent verification and validation for Class A.",
    outcome:
      "The provider can show how the current independent assessment and ongoing review cover the underlying alternative security framework.",
    specificGap:
      "A SOC 2 Type II report may support the underlying framework but does not by itself resolve Class A freshness, scope, carve-outs, or persistent review.",
    specificQuestion:
      "Which assessment materials demonstrate the underlying alternative security framework and what ongoing coverage remains?",
  },
  "KSI-CMT-LMC": {
    summary:
      "Show that modifications to the cloud service offering are logged and monitored across every production change path.",
    outcome:
      "A reviewer can trace deployed, automated, direct, and emergency changes to reviewable records and monitoring.",
    specificGap:
      "SOC 2 change testing may omit emergency changes, infrastructure drift, direct console changes, or deployment-to-ticket traceability.",
    specificQuestion:
      "Can engineering reconcile every production change source to approval, deployment, audit logging, and post-change monitoring?",
  },
  "KSI-CNA-RNT": {
    summary:
      "Restrict network traffic to documented, necessary paths for the cloud service offering.",
    outcome:
      "Ingress, egress, service, and administrative paths are technically enforced and validated against observed traffic.",
    specificGap:
      "SOC 2 may sample firewall changes without proving complete path necessity or current enforcement.",
    specificQuestion:
      "Which paths are permitted, who approved them, and how are unused or unexpected paths detected?",
  },
  "KSI-CED-RAT": {
    summary:
      "Review all applicable security training content, assignments, completion, and exceptions.",
    outcome:
      "Training coverage and content remain current for every relevant role supporting the offering.",
    specificGap:
      "A SOC 2 completion sample may not establish that all curriculum, roles, and exceptions were reviewed.",
    specificQuestion:
      "Who confirms the population and curriculum are complete after role, system, or threat changes?",
  },
  "KSI-IAM-AAM": {
    summary:
      "Automate account lifecycle management and make manual exceptions visible and reviewable.",
    outcome:
      "Workforce, privileged, service, and emergency accounts follow traceable creation, change, disablement, and review paths.",
    specificGap:
      "SOC 2 lifecycle samples may not prove automation coverage, nonhuman identities, or dormant-account handling.",
    specificQuestion:
      "Which account types bypass automation and how are those exceptions detected and approved?",
  },
  "KSI-IAM-APM": {
    summary:
      "Adopt and enforce passwordless authentication methods across the applicable offering boundary.",
    outcome:
      "Authentication coverage, recovery, privileged access, exceptions, and enforcement are technically demonstrable.",
    specificGap:
      "SOC 2 multifactor-authentication testing does not necessarily prove passwordless coverage or phishing-resistant enforcement.",
    specificQuestion:
      "Which identities and access paths are not passwordless, and what approved transition or exception applies?",
  },
  "KSI-INR-RIR": {
    summary: "Review incident response procedures, exercises, findings, and tracked improvements.",
    outcome:
      "The current procedure reflects the offering, third parties, federal reporting path, and lessons from exercises or incidents.",
    specificGap:
      "A SOC 2 annual review control may not cover FedRAMP recipients, deadlines, dependencies, or unresolved exercise findings.",
    specificQuestion:
      "What changed after the last exercise or incident, and which corrective actions remain open?",
  },
  "KSI-SVC-SIN": {
    summary:
      "Maintain and communicate the security information needed to operate and evaluate the cloud service offering.",
    outcome:
      "Authoritative security information is current, scoped, owned, and available to each intended audience.",
    specificGap:
      "A SOC 2 policy library may not establish the completeness or accessibility of Class A service information.",
    specificQuestion:
      "Which information do operators, customers, provider approvers, and reviewers need, and how is staleness detected?",
  },
};

const defaultOverride = (title: string) => ({
  summary: `Prepare a scoped, reviewable record for ${title} without assuming that a generic SOC 2 control satisfies it.`,
  outcome: `The provider can explain the ${title} decision, its current operation, and the remaining Class A-specific work.`,
  specificGap: `SOC 2 material may provide context for ${title}, but applicability, scope, timing, and required FedRAMP artifacts still need confirmation.`,
  specificQuestion: `Which confirmed SOC 2 control or tested record supports ${title}, and what does it leave unresolved?`,
});

const sharedChecks = {
  scopeChecks: [
    "Confirm the control covers the same product, environment, data, identities, dependencies, and third parties as the proposed federal offering.",
  ],
  auditPeriodChecks: [
    "Confirm the control operated during the relevant SOC 2 Type II period and identify any gap between that period and the intended application timeline.",
  ],
  testResultChecks: [
    "Read the actual auditor procedure and result; a control title or Trust Services Criterion identifier alone is not enough.",
  ],
  exceptionChecks: [
    "Identify exceptions, sample failures, deviations, and management responses that could weaken the proposed reuse.",
  ],
  carveOutChecks: [
    "Determine whether a carved-out provider performs any part of the claimed process or can affect federal customer data or service security.",
  ],
  subserviceOrganizationChecks: [
    "Confirm inclusive or carve-out treatment and obtain the evidence needed for responsibilities the SOC 2 report does not test directly.",
  ],
  complementaryControlChecks: [
    "Record complementary user-entity and subservice-organization controls and decide whether the federal use case can satisfy each dependency.",
  ],
  verificationQuestions: [
    "Can an accountable owner trace the claimed design to current systems, records, scope, and documented exceptions?",
  ],
  validationQuestions: [
    "Does a dated sample show the process operated across the claimed boundary, including negative cases and exceptions?",
  ],
  commonWeakMappings: [
    "Mapping by Trust Services Criterion or title alone without checking the actual control, scope, test period, result, and exceptions.",
  ],
  strongMappingCharacteristics: [
    "The mapping cites the actual control, report page, excerpt, auditor procedure and result, scope, period, reviewer, review date, and remaining gap.",
  ],
  commonBlockers: [
    "Scope mismatch, stale testing, material exceptions, carved-out dependencies, unconfirmed ownership, or missing FedRAMP-specific evidence.",
  ],
  expertReviewTriggers: [
    "Seek expert review when scope is ambiguous, an exception affects the claim, a carved-out provider performs a material function, or the rule interpretation changes a provider representation.",
  ],
  narrativeOutline: [
    "Confirmed SOC 2 support",
    "Scope and period alignment",
    "What the tested control establishes",
    "FedRAMP-specific implementation, verification, or validation still needed",
    "Exceptions and unresolved judgment",
    "Provider reviewer and approval",
  ],
} as const;

export const SOC2_MAPPING_PLAYBOOKS: readonly Soc2MappingPlaybook[] = RULE_REGISTRY.map((rule) => {
  const profile = profiles[profileForRule(rule.id)];
  const override = mandatoryOverrides[rule.id] ?? defaultOverride(rule.officialTitle);
  return {
    ruleId: rule.id,
    contentVersion: "2026.07.18-beta.1",
    contentReviewStatus: "Draft",
    reviewer: null,
    reviewDate: null,
    disclaimer: "Ancilis guidance — explanatory content, not official FedRAMP text.",
    requirementSummary: override.summary,
    intendedOutcome: override.outcome,
    trustServicesCriteria: profile.trustServicesCriteria,
    supportingControlPatterns: profile.supportingControlPatterns,
    insufficientControlPatterns: profile.insufficientControlPatterns,
    whatSoc2MayEstablish: profile.whatSoc2MayEstablish,
    whatSoc2UsuallyDoesNotEstablish: [
      ...profile.whatSoc2UsuallyDoesNotEstablish,
      override.specificGap,
    ],
    ...sharedChecks,
    commonReusableEvidence: profile.commonReusableEvidence,
    fedrampSpecificEvidenceNeeded: profile.fedrampSpecificEvidenceNeeded,
    implementationQuestions: [override.specificQuestion],
    organizationalOwner: rule.id.startsWith("KSI-")
      ? "Security engineering lead"
      : rule.id.startsWith("IEC-")
        ? "Incident response owner"
        : rule.id.startsWith("MAS-")
          ? "Security architecture owner"
          : "FedRAMP program owner",
    technicalTeams: profile.technicalTeams,
    officialSourceReferences: [rule.officialSourceReference],
    keywords: profile.keywords,
  };
});

const statusCounts = SOC2_MAPPING_PLAYBOOKS.reduce<Record<string, number>>((counts, playbook) => {
  counts[playbook.contentReviewStatus] = (counts[playbook.contentReviewStatus] ?? 0) + 1;
  return counts;
}, {});

export const SOC2_PLAYBOOK_MANIFEST = {
  contentVersion: "2026.07.18-beta.1",
  catalogVersion: CATALOG_MANIFEST.catalogVersion,
  total: SOC2_MAPPING_PLAYBOOKS.length,
  byStatus: statusCounts,
} as const;

export function getSoc2MappingPlaybook(ruleId: string) {
  return SOC2_MAPPING_PLAYBOOKS.find((playbook) => playbook.ruleId === ruleId);
}

export interface RuleGuidanceRecord {
  readonly authoredBy: "Ancilis";
  readonly contentVersion: string;
  readonly contentReviewStatus: PlaybookReviewStatus;
  readonly reviewer: string | null;
  readonly reviewDate: string | null;
  readonly disclaimer: string;
  readonly evidenceExamples: readonly string[];
  readonly whyItMatters: string;
  readonly mappingHints: readonly string[];
  readonly outputDocumentMappings: readonly string[];
  readonly jsonSchemaMappings: readonly string[];
  readonly plainLanguage: string;
  readonly questions: readonly string[];
  readonly ruleId: string;
  readonly scopeConcerns: readonly string[];
  readonly suggestedOwner: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const outputMappingsFor = (id: string): string[] => {
  const mappings = ["Mandatory requirements report", "Detailed gap report", "Action plan"];
  if (id.startsWith("MAS-")) mappings.push("Scope summary");
  if (id.startsWith("KSI-") || id.startsWith("SDR-")) mappings.push("Security Decision Record");
  if (id.startsWith("IEC-")) mappings.push("Incident Report");
  if (/^(CCM|VDR|VER)-/u.test(id)) mappings.push("Ongoing Certification Report");
  if (/^(FRC|CPO|CDS)-/u.test(id)) mappings.push("Certification Package Overview");
  if (/^(IVV|FRC)-/u.test(id)) mappings.push("External assessment materials checklist");
  return [...new Set(mappings)];
};

const schemaMappingsFor = (official: OfficialRule, id: string): string[] => {
  const schema =
    isObject(official.schema) && typeof official.schema.url === "string"
      ? [official.schema.url]
      : [];
  if (schema.length > 0) return schema;
  if (id.startsWith("KSI-") || id.startsWith("SDR-")) {
    return ["fedramp-security-decision-record-schema-2026-06-24.json"];
  }
  if (/^(CCM|VDR|VER)-/u.test(id)) {
    return ["fedramp-ongoing-certification-report-schema-2026-06-24.json"];
  }
  return [];
};

export const RULE_GUIDANCE: readonly RuleGuidanceRecord[] = RULE_REGISTRY.map((rule) => {
  const playbook = getSoc2MappingPlaybook(rule.id);
  if (!playbook) throw new Error(`Missing SOC 2 mapping playbook for ${rule.id}`);
  return {
    authoredBy: "Ancilis",
    contentVersion: playbook.contentVersion,
    contentReviewStatus: playbook.contentReviewStatus,
    reviewer: playbook.reviewer,
    reviewDate: playbook.reviewDate,
    disclaimer:
      "Ancilis guidance supports preparation only; it is not a FedRAMP determination, certification, legal opinion, or substitute for provider and assessor review.",
    evidenceExamples: [
      ...playbook.commonReusableEvidence,
      ...playbook.fedrampSpecificEvidenceNeeded,
    ],
    whyItMatters: playbook.intendedOutcome,
    mappingHints: [
      ...playbook.whatSoc2MayEstablish,
      ...playbook.whatSoc2UsuallyDoesNotEstablish,
      ...playbook.commonWeakMappings,
    ],
    outputDocumentMappings: outputMappingsFor(rule.id),
    jsonSchemaMappings: schemaMappingsFor(rule.official, rule.id),
    plainLanguage: playbook.requirementSummary,
    questions: [
      ...playbook.implementationQuestions,
      ...playbook.verificationQuestions,
      ...playbook.validationQuestions,
    ],
    ruleId: rule.id,
    scopeConcerns: [
      ...playbook.scopeChecks,
      ...playbook.auditPeriodChecks,
      ...playbook.exceptionChecks,
      ...playbook.carveOutChecks,
    ],
    suggestedOwner: playbook.organizationalOwner,
  };
});
