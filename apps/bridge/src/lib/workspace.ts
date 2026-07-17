import {
  createEmptyProject,
  evaluateEligibility,
  type AnswerValue,
  type BridgeProject,
  type EligibilityQuestionId,
  type RequirementWork,
} from "@class-a-bridge/project";
import { RULE_GUIDANCE, RULE_REGISTRY, RULE_SELECTIONS } from "@class-a-bridge/rules";

const materialRecords: BridgeProject["materials"] = [
  {
    id: "material-soc2",
    kind: "soc2_report",
    title: "Complete SOC 2 Type II report",
    status: "missing",
    rationale: "Add or confirm the report used for this preparation project.",
  },
  {
    id: "material-bridge",
    kind: "bridge_letter",
    title: "Bridge or gap letter",
    status: "needs_confirmation",
    rationale:
      "Confirm whether the planned application date creates a gap after the report period.",
  },
  {
    id: "material-engagement",
    kind: "engagement_documentation",
    title: "Verified audit-engagement documentation",
    status: "missing",
    rationale: "Collect the independently verified engagement record when applicable.",
  },
  {
    id: "material-schedule",
    kind: "upcoming_report_schedule",
    title: "Estimated schedule for the upcoming report",
    status: "missing",
    rationale: "Record the next assessment schedule and expected report date.",
  },
  {
    id: "material-supplemental",
    kind: "supplemental_evidence",
    title: "Supplemental compliance evidence",
    status: "needs_confirmation",
    rationale: "Identify evidence needed for exceptions, carve-outs, or report-period gaps.",
  },
];

function requirementRecord(ruleId: string): RequirementWork {
  const guidance = RULE_GUIDANCE.find((item) => item.ruleId === ruleId);
  return {
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
    owner: guidance?.suggestedOwner ?? "FedRAMP program owner",
    notes: "",
    openQuestions: [],
    exceptions: [],
  };
}

export function initializeProject(
  name = "Class A preparation",
  organization = "Your organization",
) {
  const project = createEmptyProject(name, organization);
  project.materials = structuredClone(materialRecords);
  project.requirements = RULE_REGISTRY.map(({ id }) => requirementRecord(id));
  project.actions = deriveActions(project);
  return project;
}

export function answerEligibility(
  project: BridgeProject,
  questionId: EligibilityQuestionId,
  value: AnswerValue,
): BridgeProject {
  const next = structuredClone(project);
  const answer = { questionId, value, answeredAt: new Date().toISOString() };
  const existing = next.eligibility.answers.findIndex((item) => item.questionId === questionId);
  if (existing >= 0) next.eligibility.answers.splice(existing, 1, answer);
  else next.eligibility.answers.push(answer);
  if (next.eligibility.answers.length === 8) {
    const input = Object.fromEntries(
      next.eligibility.answers.map((item) => [item.questionId, item.value]),
    );
    const result = evaluateEligibility(input);
    next.eligibility.result = result;
    next.eligibility.history.push(structuredClone(result));
  }
  next.metadata.updatedAt = new Date().toISOString();
  next.actions = deriveActions(next);
  return next;
}

function action(
  id: string,
  title: string,
  description: string,
  category: BridgeProject["actions"][number]["category"],
  priority: BridgeProject["actions"][number]["priority"],
  owner: string,
  sourceRefs: readonly string[],
  nextRoute: string,
): BridgeProject["actions"][number] {
  return {
    id,
    title,
    description,
    category,
    priority,
    owner,
    status: "open",
    sourceRefs: [...sourceRefs],
    nextRoute,
  };
}

export function deriveActions(project: BridgeProject): BridgeProject["actions"] {
  const existing = new Map(project.actions.map((item) => [item.id, item]));
  const generated: BridgeProject["actions"] = [];
  for (const finding of project.eligibility.result?.findings ?? []) {
    if (finding.certainty === "confirmed" && !finding.humanReview) continue;
    generated.push(
      action(
        `eligibility-${finding.id}`,
        finding.title,
        finding.summary,
        "eligibility_blockers",
        finding.title === "Potential blocker" ? "critical" : "high",
        "Compliance owner",
        finding.ruleRefs,
        "/eligibility",
      ),
    );
  }
  project.scope.mismatchFindings.forEach((finding, index) =>
    generated.push(
      action(
        `scope-${index}`,
        "Resolve scope mismatch",
        finding,
        "scope_blockers",
        "critical",
        "GRC and architecture owners",
        ["MAS-CSO-IIR"],
        "/scope",
      ),
    ),
  );
  project.materials
    .filter((item) => ["missing", "expiring", "needs_confirmation"].includes(item.status))
    .forEach((item) =>
      generated.push(
        action(
          `material-${item.id}`,
          item.title,
          item.rationale,
          "before_application_preparation",
          item.kind === "soc2_report" ? "critical" : "high",
          "Compliance owner",
          ["FRC-CLA-EAM"],
          "/soc2-materials",
        ),
      ),
    );
  const mandatory = new Set<string>(RULE_SELECTIONS.mandatory);
  for (const requirement of project.requirements.filter((item) => mandatory.has(item.ruleId))) {
    if (["complete_for_internal_review", "approved_by_provider"].includes(requirement.status))
      continue;
    const category =
      requirement.status === "evidence_missing"
        ? "missing_evidence"
        : requirement.status === "needs_technical_confirmation"
          ? "technical_confirmation"
          : "missing_implementation";
    generated.push(
      action(
        `requirement-${requirement.ruleId}`,
        `Advance ${requirement.ruleId}`,
        `Current status: ${requirement.status.replaceAll("_", " ")}. Add or confirm the next missing record.`,
        category,
        "high",
        requirement.owner || "Requirement owner",
        [requirement.ruleId],
        `/requirements/${requirement.ruleId}`,
      ),
    );
  }
  project.evidence
    .filter((item) => item.reviewStatus !== "reviewed")
    .forEach((item) =>
      generated.push(
        action(
          `evidence-${item.id}`,
          `Review evidence candidate: ${item.title}`,
          "Confirm relevance, period, scope, integrity, and sufficiency with a human reviewer.",
          "missing_evidence",
          "medium",
          item.owner,
          item.relatedRequirementIds,
          "/evidence",
        ),
      ),
    );
  if (!project.organization.accountableExecutive)
    generated.push(
      action(
        "executive-owner",
        "Identify the accountable executive",
        "Record the executive who can approve provider representations and the final internal package.",
        "executive_approval",
        "high",
        "Executive sponsor",
        ["FRC-CSO-PKG"],
        "/settings",
      ),
    );

  return generated.map((item) => {
    const prior = existing.get(item.id);
    return prior
      ? {
          ...item,
          status: prior.status,
          ...(prior.owner ? { owner: prior.owner } : {}),
          ...(prior.dueDate ? { dueDate: prior.dueDate } : {}),
        }
      : item;
  });
}

export function requirementMilestone(project: BridgeProject) {
  const mandatory = project.requirements.filter((item) =>
    (RULE_SELECTIONS.mandatory as readonly string[]).includes(item.ruleId),
  );
  const complete = mandatory.filter((item) =>
    ["complete_for_internal_review", "approved_by_provider"].includes(item.status),
  ).length;
  return { complete, total: mandatory.length || RULE_SELECTIONS.mandatory.length };
}

export function evidenceFreshness(
  reviewDate: string | undefined,
): "current" | "due_soon" | "stale" | "unknown" {
  if (!reviewDate) return "unknown";
  const days = (new Date(reviewDate).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "stale";
  if (days <= 30) return "due_soon";
  return "current";
}

export function soc2PackageFreshness(
  project: BridgeProject,
  reference = new Date(),
): BridgeProject["snapshots"][number]["freshnessStatus"] {
  const freshnessAnswer = project.eligibility.answers.find(
    (answer) => answer.questionId === "soc2_fresh",
  );
  if (freshnessAnswer?.value === "no") return "stale";

  const referenceTimestamp = reference.getTime();
  if (!Number.isFinite(referenceTimestamp)) return "needs_confirmation";
  const referenceDate = reference.toISOString().slice(0, 10);
  if (project.evidence.some((item) => item.reviewDate && item.reviewDate < referenceDate)) {
    return "stale";
  }

  const sourceDate = project.soc2.reportDate?.trim() || project.soc2.reportEnd?.trim();
  if (!sourceDate) return "needs_confirmation";
  const timestamp = Date.parse(sourceDate);
  if (!Number.isFinite(timestamp) || timestamp > referenceTimestamp) return "needs_confirmation";
  const ageDays = (referenceTimestamp - timestamp) / 86_400_000;
  if (ageDays >= 365) return "stale";
  if (ageDays >= 335) return "aging";
  if (!freshnessAnswer || freshnessAnswer.value !== "yes") return "needs_confirmation";
  const agingThrough = new Date(referenceTimestamp + 30 * 86_400_000).toISOString().slice(0, 10);
  if (
    project.evidence.some(
      (item) =>
        item.reviewDate && item.reviewDate >= referenceDate && item.reviewDate <= agingThrough,
    )
  ) {
    return "aging";
  }
  return "fresh";
}
