import type { BridgeProject } from "@class-a-bridge/project";
import { getRule, RULE_SELECTIONS } from "@class-a-bridge/rules";

import {
  callout,
  PREPARATION_DISCLAIMER,
  renderStandaloneHtml,
  section,
  table,
  text,
} from "./html";
import type {
  FinalReviewCheck,
  FinalReviewChecklist,
  PackageFreshness,
  PackageValidationSummary,
} from "./types";

const placeholderPattern =
  /\b(?:TODO|TBD|FIXME|PLACEHOLDER)\b|\[(?:insert|confirm|describe)[^\]]*\]/iu;

function placeholders(project: BridgeProject) {
  const unresolved: string[] = [];
  const inspect = (path: string, value: string) => {
    if (placeholderPattern.test(value)) unresolved.push(path);
  };
  inspect("scope.summary", project.scope.summary);
  inspect("scope.dataFlowSummary", project.scope.dataFlowSummary);
  project.scope.questions.forEach((value, index) => inspect(`scope.questions.${index}`, value));
  for (const requirement of project.requirements) {
    inspect(`requirements.${requirement.ruleId}.response`, requirement.userResponse);
    inspect(
      `requirements.${requirement.ruleId}.implementation`,
      requirement.implementationNarrative,
    );
    inspect(`requirements.${requirement.ruleId}.verification`, requirement.verificationNarrative);
    inspect(`requirements.${requirement.ruleId}.validation`, requirement.validationNarrative);
    requirement.openQuestions.forEach((value, index) =>
      inspect(`requirements.${requirement.ruleId}.openQuestions.${index}`, value),
    );
  }
  project.actions.forEach((action) =>
    inspect(`actions.${action.id}.description`, action.description),
  );
  return unresolved;
}

function missingReferences(project: BridgeProject) {
  const evidenceIds = new Set(project.evidence.map((item) => item.id));
  const controlIds = new Set(project.soc2.controls.map((item) => item.id));
  const requirementIds = new Set(project.requirements.map((item) => item.ruleId));
  const resourceIds = new Set(project.scope.resources.map((item) => item.id));
  const missing: string[] = [];
  for (const requirement of project.requirements) {
    for (const evidenceId of requirement.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        missing.push(
          `Requirement ${requirement.ruleId} references missing evidence ${evidenceId}.`,
        );
      }
    }
    for (const controlId of requirement.soc2ControlIds) {
      if (!controlIds.has(controlId)) {
        missing.push(
          `Requirement ${requirement.ruleId} references missing SOC 2 control ${controlId}.`,
        );
      }
    }
  }
  for (const mapping of project.mappings) {
    if (!controlIds.has(mapping.soc2ControlId)) {
      missing.push(
        `Mapping ${mapping.id} references missing SOC 2 control ${mapping.soc2ControlId}.`,
      );
    }
    if (!getRule(mapping.classARuleId)) {
      missing.push(
        `Mapping ${mapping.id} references unknown Class A rule ${mapping.classARuleId}.`,
      );
    }
  }
  for (const item of project.evidence) {
    for (const requirementId of item.relatedRequirementIds) {
      if (!requirementIds.has(requirementId)) {
        missing.push(`Evidence ${item.id} references missing requirement ${requirementId}.`);
      }
    }
    for (const controlId of item.relatedSoc2ControlIds) {
      if (!controlIds.has(controlId)) {
        missing.push(`Evidence ${item.id} references missing SOC 2 control ${controlId}.`);
      }
    }
  }
  for (const relationship of project.scope.relationships) {
    if (!resourceIds.has(relationship.fromId)) {
      missing.push(
        `Scope relationship ${relationship.id} references missing resource ${relationship.fromId}.`,
      );
    }
    if (!resourceIds.has(relationship.toId)) {
      missing.push(
        `Scope relationship ${relationship.id} references missing resource ${relationship.toId}.`,
      );
    }
  }
  return missing;
}

function freshness(project: BridgeProject, generatedAt: string): PackageFreshness {
  const date = generatedAt.slice(0, 10);
  const freshnessAnswer = project.eligibility.answers.find(
    (answer) => answer.questionId === "soc2_fresh",
  );
  if (freshnessAnswer?.value === "no") return "stale";
  if (project.evidence.some((item) => item.reviewDate && item.reviewDate < date)) return "stale";

  const reportDate = project.soc2.reportDate ?? project.soc2.reportEnd;
  const completedAt = reportDate ? new Date(`${reportDate}T00:00:00.000Z`) : undefined;
  const generated = new Date(generatedAt);
  if (!completedAt || Number.isNaN(completedAt.getTime()) || completedAt > generated) {
    return "needs_confirmation";
  }
  const expiresAt = new Date(completedAt);
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
  if (generated >= expiresAt) return "stale";

  const agingThrough = new Date(generated);
  agingThrough.setUTCDate(agingThrough.getUTCDate() + 30);
  if (expiresAt <= agingThrough) return "aging";
  if (!freshnessAnswer || freshnessAnswer.value === "not_sure") return "needs_confirmation";
  if (
    project.evidence.some(
      (item) =>
        item.reviewDate &&
        item.reviewDate >= date &&
        item.reviewDate <= agingThrough.toISOString().slice(0, 10),
    )
  ) {
    return "aging";
  }
  return "fresh";
}

const check = (
  id: string,
  label: string,
  status: FinalReviewCheck["status"],
  detail: string,
  route: string,
  resolution: string,
): FinalReviewCheck => ({ id, label, status, detail, route, resolution });

export function createFinalReviewChecklist(
  project: BridgeProject,
  validation: PackageValidationSummary,
  generatedAt = new Date().toISOString(),
): FinalReviewChecklist {
  const mandatoryIds = RULE_SELECTIONS.mandatory as readonly string[];
  const mandatory = mandatoryIds.map((ruleId) => ({
    ruleId,
    work: project.requirements.find((requirement) => requirement.ruleId === ruleId),
  }));
  const completeDrafts = mandatory.filter(({ work }) =>
    work ? ["complete_for_internal_review", "approved_by_provider"].includes(work.status) : false,
  );
  const missingApprovals = mandatory
    .filter(({ work }) => work?.status !== "approved_by_provider")
    .map(({ ruleId }) => ruleId);
  const unresolvedPlaceholders = placeholders(project);
  const references = missingReferences(project);
  const unresolvedScope = project.scope.resources.filter(
    (resource) => resource.needsTechnicalConfirmation,
  ).length;
  const checks: FinalReviewCheck[] = [
    check(
      "eligibility",
      "Eligibility result reviewed",
      project.eligibility.result ? "pass" : "fail",
      project.eligibility.result
        ? project.eligibility.result.label
        : "No preliminary eligibility result exists.",
      "#/eligibility",
      "Complete or revise the preliminary eligibility interview.",
    ),
    check(
      "scope",
      "Scope decisions confirmed",
      unresolvedScope === 0 && project.scope.questions.length === 0 ? "pass" : "warning",
      `${unresolvedScope} resources and ${project.scope.questions.length} questions need confirmation.`,
      "#/scope",
      "Resolve technical-confirmation flags and record the provider-approved boundary rationale.",
    ),
    check(
      "mandatory-records",
      "All mandatory requirement records exist",
      mandatory.every(({ work }) => Boolean(work)) ? "pass" : "fail",
      `${mandatory.filter(({ work }) => Boolean(work)).length} of ${mandatoryIds.length} records exist.`,
      "#/requirements",
      "Create and assign every mandatory Class A requirement record.",
    ),
    check(
      "mandatory-drafts",
      "Mandatory drafts complete for internal review",
      completeDrafts.length === mandatoryIds.length ? "pass" : "fail",
      `${completeDrafts.length} of ${mandatoryIds.length} records are complete for internal review or provider-approved.`,
      "#/requirements",
      "Complete implementation, verification, validation, evidence, and open-question fields.",
    ),
    check(
      "references",
      "All references resolve",
      references.length === 0 ? "pass" : "fail",
      references.length === 0
        ? "All checked references resolve."
        : `${references.length} references are missing.`,
      "#/evidence",
      "Repair or remove missing evidence and SOC 2 control references.",
    ),
    check(
      "placeholders",
      "No unresolved placeholders",
      unresolvedPlaceholders.length === 0 ? "pass" : "fail",
      `${unresolvedPlaceholders.length} placeholder fields remain.`,
      "#/package",
      "Replace every TODO, TBD, FIXME, placeholder, or bracketed drafting prompt.",
    ),
    check(
      "provider-approvals",
      "Provider approvals recorded",
      missingApprovals.length === 0 ? "pass" : "fail",
      `${missingApprovals.length} mandatory records lack provider approval.`,
      "#/requirements",
      "Have the accountable provider representative review and approve each representation.",
    ),
    check(
      "json-schema",
      "Generated JSON passes pinned schemas",
      validation.valid ? "pass" : "fail",
      validation.valid
        ? "All generated JSON is structurally valid."
        : `${validation.documents.reduce((sum, document) => sum + document.issues.length, 0)} validation issues remain.`,
      "#/package/validation",
      "Correct every linked validation issue, regenerate the documents, and validate again.",
    ),
  ];
  return {
    generatedAt,
    packageFreshness: freshness(project, generatedAt),
    checks,
    unresolvedPlaceholders,
    missingReferences: references,
    missingApprovals,
    providerSubmissionReminder:
      "Class A Bridge does not submit applications. The provider must submit its own application after completing provider, legal, technical, and independent-review steps.",
    disclaimer: PREPARATION_DISCLAIMER,
  };
}

export function renderFinalReviewChecklist(
  project: BridgeProject,
  checklist: FinalReviewChecklist,
): string {
  const body = [
    callout(
      `Package freshness: ${checklist.packageFreshness.replaceAll("_", " ")}. This indicator uses recorded answers and review dates; it is not an eligibility or acceptance determination.`,
      checklist.packageFreshness === "fresh" ? "default" : "warning",
    ),
    section(
      "Final internal-review checks",
      table(
        ["Check", "Status", "Detail", "How to resolve", "Edit route"],
        checklist.checks.map((item) => [
          item.label,
          item.status,
          item.detail,
          item.resolution,
          item.route,
        ]),
      ),
    ),
    section("Provider submission reminder", `<p>${text(checklist.providerSubmissionReminder)}</p>`),
  ].join("");
  return renderStandaloneHtml({
    title: "Final internal-review checklist",
    organization: project.organization.name,
    offering: project.offering.name,
    generatedAt: checklist.generatedAt,
    body,
    ...(project.metadata.watermark ? { watermark: project.metadata.watermark } : {}),
  });
}
