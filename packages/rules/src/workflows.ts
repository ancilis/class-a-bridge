export interface KsiWorkflow {
  readonly ruleId: string;
  readonly contentVersion: string;
  readonly contentReviewStatus: "Draft";
  readonly reviewer: null;
  readonly reviewDate: null;
  readonly outcome: string;
  readonly collectorPrompts: readonly string[];
  readonly technicalHelpers: readonly string[];
  readonly implementationSteps: readonly string[];
  readonly verificationSteps: readonly string[];
  readonly validationSteps: readonly string[];
  readonly weaknesses: readonly string[];
  readonly narrativeSections: readonly string[];
  readonly uncertainties: readonly string[];
  readonly disclaimer: string;
}

const workflow = (
  ruleId: string,
  outcome: string,
  collector: string,
  technicalHelper: string,
  implementation: string,
  verification: string,
  validation: string,
  weakness: string,
  uncertainty: string,
): KsiWorkflow => ({
  ruleId,
  contentVersion: "2026.07.18-beta.1",
  contentReviewStatus: "Draft",
  reviewer: null,
  reviewDate: null,
  outcome,
  collectorPrompts: [
    collector,
    "Identify the owner, coverage, cadence, exceptions, and source system.",
  ],
  technicalHelpers: [technicalHelper, "Record commands or queries without storing secrets."],
  implementationSteps: [
    implementation,
    "Link confirmed evidence candidates and document exceptions.",
  ],
  verificationSteps: [verification],
  validationSteps: [validation],
  weaknesses: [weakness],
  narrativeSections: ["Outcome", "Implementation", "Verification", "Validation", "Weaknesses"],
  uncertainties: [uncertainty],
  disclaimer:
    "Workflow output is preparation guidance and requires human review before provider use.",
});

export const KSI_WORKFLOWS: readonly KsiWorkflow[] = [
  workflow(
    "KSI-CMT-LMC",
    "Show that cloud-offering modifications are logged and monitored through a reviewable change trail.",
    "Which systems create, approve, deploy, and monitor production changes?",
    "Collect a bounded sample from source control, deployment, and audit logs.",
    "Inventory every change source—including pipelines, direct cloud changes, automation, dependencies, and emergency changes—and explain how each reaches the monitoring trail.",
    "Reconcile a deployed-change sample to approval, build, deployment, and audit records, and have engineering confirm no material change source is omitted.",
    "Select normal, automated, direct, and emergency changes from the relevant period and validate traceability plus post-deployment monitoring.",
    "A SOC 2 approval sample may look strong while emergency changes, infrastructure drift, or direct-console changes remain outside the trail.",
    "Escalate when engineering cannot enumerate all production change paths or when the SOC 2 test omitted a material path.",
  ),
  workflow(
    "KSI-CNA-RNT",
    "Show that network traffic is restricted to documented, necessary paths and reviewed over time.",
    "Where are ingress, egress, service-to-service, and administrative paths defined?",
    "Compare firewall, security-group, gateway, and flow-log output to the approved paths.",
    "Build the permitted-path inventory for the proposed federal boundary, including egress, administration, third-party connections, and default behavior.",
    "Have network and service owners confirm that every allowed path is necessary, approved, and represented in current enforcement records.",
    "Compare the approved path inventory to configuration and observed flow data; investigate unexpected, unused, or overly broad paths.",
    "A diagram or sampled firewall change does not prove current default-deny behavior, egress restriction, or full service-path coverage.",
    "Escalate shared-network, customer-configured, or third-party paths whose ownership or scope cannot be resolved.",
  ),
  workflow(
    "KSI-CED-RAT",
    "Show that security training content and completion are reviewed and auditable.",
    "Who receives training, what content applies, and how are overdue completions handled?",
    "Collect curriculum approval, assignment rules, completion records, and exception follow-up.",
    "Reconcile roles and system responsibilities to required curricula, content owners, assignment triggers, review dates, and overdue escalation.",
    "Have security awareness and functional leaders confirm the population, role-based content, review criteria, and exception process.",
    "Sample role changes, new starters, overdue completions, and curriculum updates to validate assignment and follow-up across the period.",
    "A completion percentage can conceal omitted populations, stale role-specific content, or unapproved exceptions.",
    "Escalate when the training population cannot be reconciled to people operating material security functions for the offering.",
  ),
  workflow(
    "KSI-IAM-AAM",
    "Show that account creation, changes, disablement, and review are consistently automated.",
    "Which identity sources and lifecycle events govern workforce and service accounts?",
    "Trace sample joiner, mover, leaver, dormant-account, and service-account events.",
    "Document automated and manual lifecycle paths for workforce, privileged, service, emergency, and customer-support identities.",
    "Have identity and system owners reconcile each account type to authoritative source, provisioning, change, disablement, review, and exception handling.",
    "Validate joiner, mover, leaver, dormant, privileged, service-account, and failed-automation cases using dated system records.",
    "An access-review control does not prove lifecycle automation completeness or timely handling of nonhuman and exceptional accounts.",
    "Escalate account types that lack an authoritative owner, lifecycle trigger, automated enforcement, or reviewed exception.",
  ),
  workflow(
    "KSI-IAM-APM",
    "Show that authentication methods and privileged access are managed with durable technical controls.",
    "Where are passwordless, phishing-resistant, emergency, and privileged methods enforced?",
    "Inspect identity-provider policy, privilege elevation, recovery, and break-glass records.",
    "Inventory authentication paths and populations, then record passwordless enforcement, recovery, privileged elevation, service identity, and approved exception treatment.",
    "Have identity engineering confirm enforcement at each customer, administrative, workforce, and privileged entry point rather than relying on policy intent.",
    "Validate successful and blocked authentication cases, recovery, break-glass use, and exception expiration from current configuration and logs.",
    "Multifactor authentication evidence may still permit passwords, weak recovery, uncovered legacy paths, or standing privileged access.",
    "Escalate any material access path that is not passwordless or lacks an owned, dated transition or exception decision.",
  ),
  workflow(
    "KSI-INR-RIR",
    "Show that incident-response procedures are reviewed, exercised, and improved.",
    "When was the plan last reviewed or exercised, and which material findings remain open?",
    "Collect the approved plan, exercise record, after-action items, and tracked remediation.",
    "Map the current incident procedure to the offering, federal reporting decisions, recipients, third parties, exercises, findings, and change triggers.",
    "Have incident, legal, privacy, service, and executive owners confirm decision rights, escalation, reporting, recovery, and corrective-action ownership.",
    "Walk a recent incident or exercise from detection through reportability, communications, recovery, final reporting, and remediation closure.",
    "A dated plan-review signature does not show that federal recipients, timing, dependencies, or unresolved exercise findings were addressed.",
    "Escalate unresolved exercise findings, ambiguous reportability ownership, or dependencies absent from the current procedure.",
  ),
  workflow(
    "KSI-SVC-SIN",
    "Show that security information is maintained, communicated, and usable for operating the service.",
    "Which security information must operators, customers, and reviewers receive and keep current?",
    "Inventory authoritative security documentation, ownership, publication, and review dates.",
    "Define the security-information inventory by audience, source of truth, offering scope, owner, approval, publication method, review cadence, and change trigger.",
    "Have operators, customer trust, security architecture, and GRC confirm that each audience receives current and consistent information.",
    "Sample changed controls, architecture, incidents, and customer communications to validate that authoritative information was updated and distributed.",
    "A policy repository can be current yet omit operator instructions, customer-facing representations, scope changes, or review-package information.",
    "Escalate conflicting sources, stale public representations, unclear ownership, or security information that excludes material service dependencies.",
  ),
];
