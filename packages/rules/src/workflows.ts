export interface KsiWorkflow {
  readonly ruleId: string;
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
): KsiWorkflow => ({
  ruleId,
  outcome,
  collectorPrompts: [
    collector,
    "Identify the owner, coverage, cadence, exceptions, and source system.",
  ],
  technicalHelpers: [technicalHelper, "Record commands or queries without storing secrets."],
  implementationSteps: [
    "Describe the production measure and its boundary.",
    "Link confirmed evidence candidates and document exceptions.",
  ],
  verificationSteps: ["Have an accountable owner confirm the design and expected coverage."],
  validationSteps: ["Sample dated output and confirm the measure operated as described."],
  weaknesses: ["Record coverage gaps, manual steps, stale evidence, and third-party dependencies."],
  narrativeSections: ["Outcome", "Implementation", "Verification", "Validation", "Weaknesses"],
  uncertainties: ["Mark unresolved scope or evidence questions for human review."],
  disclaimer:
    "Workflow output is preparation guidance and requires human review before provider use.",
});

export const KSI_WORKFLOWS: readonly KsiWorkflow[] = [
  workflow(
    "KSI-CMT-LMC",
    "Show that cloud-offering modifications are logged and monitored through a reviewable change trail.",
    "Which systems create, approve, deploy, and monitor production changes?",
    "Collect a bounded sample from source control, deployment, and audit logs.",
  ),
  workflow(
    "KSI-CNA-RNT",
    "Show that network traffic is restricted to documented, necessary paths and reviewed over time.",
    "Where are ingress, egress, service-to-service, and administrative paths defined?",
    "Compare firewall, security-group, gateway, and flow-log output to the approved paths.",
  ),
  workflow(
    "KSI-CED-RAT",
    "Show that security training content and completion are reviewed and auditable.",
    "Who receives training, what content applies, and how are overdue completions handled?",
    "Collect curriculum approval, assignment rules, completion records, and exception follow-up.",
  ),
  workflow(
    "KSI-IAM-AAM",
    "Show that account creation, changes, disablement, and review are consistently automated.",
    "Which identity sources and lifecycle events govern workforce and service accounts?",
    "Trace sample joiner, mover, leaver, dormant-account, and service-account events.",
  ),
  workflow(
    "KSI-IAM-APM",
    "Show that authentication methods and privileged access are managed with durable technical controls.",
    "Where are passwordless, phishing-resistant, emergency, and privileged methods enforced?",
    "Inspect identity-provider policy, privilege elevation, recovery, and break-glass records.",
  ),
  workflow(
    "KSI-INR-RIR",
    "Show that incident-response procedures are reviewed, exercised, and improved.",
    "When was the plan last reviewed or exercised, and which material findings remain open?",
    "Collect the approved plan, exercise record, after-action items, and tracked remediation.",
  ),
  workflow(
    "KSI-SVC-SIN",
    "Show that security information is maintained, communicated, and usable for operating the service.",
    "Which security information must operators, customers, and reviewers receive and keep current?",
    "Inventory authoritative security documentation, ownership, publication, and review dates.",
  ),
];
