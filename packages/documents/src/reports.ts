import { isProviderApprovedRequirement, safeFilename } from "@class-a-bridge/project";
import type { BridgeProject } from "@class-a-bridge/project";
import { getRule, RULE_SELECTIONS } from "@class-a-bridge/rules";

import { createAdvisorHandoff } from "./advisor";
import {
  callout,
  list,
  PRINT_PDF_INSTRUCTIONS,
  renderStandaloneHtml,
  section,
  table,
  text,
} from "./html";
import {
  REPORT_KINDS,
  type GenerationOptions,
  type HumanReport,
  type HumanReportKind,
} from "./types";

export { REPORT_KINDS };

const TITLES: Record<HumanReportKind, string> = {
  "preliminary-fit": "Preliminary Class A fit assessment",
  "executive-readiness": "Executive readiness summary",
  "detailed-gap": "Detailed SOC 2-to-Class A gap report",
  "scope-summary": "Cloud service offering scope summary",
  "mandatory-requirements": "Mandatory Class A requirements report",
  "evidence-manifest": "Evidence candidate manifest",
  "action-plan": "Action plan",
  "package-validation": "Package validation report",
  "advisor-handoff": "Advisor handoff report",
  "soc2-mapping": "SOC 2-to-Class A mapping report",
  "external-materials": "External assessment materials checklist",
  "open-items": "Open items report",
  "provider-approval": "Provider approval record",
};

const slug = (value: string) =>
  safeFilename(
    value
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, "-")
      .replaceAll(/^-|-$/gu, ""),
  );

const label = (value: string) =>
  value
    .replaceAll("_", " ")
    .replaceAll("soc2", "SOC 2")
    .replaceAll("fedramp", "FedRAMP")
    .replace(/^./u, (character) => character.toUpperCase());

const ruleName = (ruleId: string) => {
  const official = getRule(ruleId)?.official;
  return typeof official?.name === "string" ? official.name : "Official title unavailable";
};

const resultBody = (project: BridgeProject) => {
  const result = project.eligibility.result;
  if (!result) {
    return callout(
      "Complete the eight-question preliminary interview to generate an explainable fit result.",
      "warning",
    );
  }
  const answers = project.eligibility.answers.map((answer) => [
    label(answer.questionId),
    label(answer.value),
    answer.note ?? "",
  ]);
  return [
    callout(
      `<p><strong>${text(result.label)}</strong></p><p>${text(result.summary)}</p><p>${text(result.disclaimer)}</p>`,
      result.classification === "not_currently_eligible" ? "danger" : "default",
    ),
    section("Why this result", list(result.reasons, "No reasons recorded.")),
    section("Supporting answers", table(["Question", "Answer", "Note"], answers)),
    section("Potential blockers", list(result.blockers, "No potential blockers were identified.")),
    section(
      "Missing information",
      list(result.missingInformation, "No missing information recorded."),
    ),
    section("Next three actions", list(result.recommendedActions)),
    section("Applicable rule references", list(result.ruleRefs)),
  ].join("");
};

const readinessBody = (project: BridgeProject) => {
  const mandatory = project.requirements.filter((requirement) =>
    (RULE_SELECTIONS.mandatory as readonly string[]).includes(requirement.ruleId),
  );
  const complete = mandatory.filter(
    (requirement) =>
      requirement.status === "complete_for_internal_review" ||
      isProviderApprovedRequirement(requirement),
  ).length;
  const blockers = project.actions.filter(
    (action) =>
      action.status !== "done" &&
      ["eligibility_blockers", "scope_blockers"].includes(action.category),
  );
  const nextActions = project.actions
    .filter((action) => action.status !== "done")
    .sort((left, right) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      return order[left.priority] - order[right.priority];
    })
    .slice(0, 3);
  return [
    section(
      "Milestone progress",
      list([
        project.eligibility.result ? "Eligibility reviewed" : "Eligibility remains unresolved",
        project.scope.resources.length > 0
          ? "Scope inventory started"
          : "Scope inventory not started",
        `${complete} of ${RULE_SELECTIONS.mandatory.length} mandatory requirement records have complete internal-review drafts.`,
        `${mandatory.length} of ${RULE_SELECTIONS.mandatory.length} mandatory requirement records have been created.`,
        `${project.evidence.filter((item) => item.reviewStatus === "reviewed").length} evidence candidates reviewed`,
      ]),
    ),
    section(
      "Top blockers",
      table(
        ["Action", "Category", "Owner", "Next step"],
        blockers.map((action) => [
          action.title,
          label(action.category),
          action.owner,
          action.nextRoute,
        ]),
      ),
    ),
    section(
      "Recommended next actions",
      table(
        ["Action", "Priority", "Owner", "Status"],
        nextActions.map((action) => [
          action.title,
          label(action.priority),
          action.owner,
          label(action.status),
        ]),
      ),
    ),
    section(
      "Advisor-review flags",
      list(project.advisorFlags, "No advisor-review flags recorded."),
    ),
  ].join("");
};

const mappingsBody = (project: BridgeProject, detailed: boolean) => {
  const rows = project.mappings.map((mapping) => [
    mapping.soc2ControlId,
    mapping.reportPage,
    mapping.classARuleId,
    label(mapping.coverage),
    mapping.reason,
    mapping.gapDescription,
    detailed
      ? mapping.excerpt
      : mapping.confirmed
        ? "Confirmed by user"
        : "Needs user confirmation",
    mapping.additionalEvidenceNeeded,
  ]);
  return [
    callout(
      "A mapping is context, not proof of completion. Suggested mappings require user confirmation, and a SOC 2 control alone never completes a Class A requirement.",
      "warning",
    ),
    section(
      "Control mappings",
      table(
        [
          "SOC 2 control",
          "Page",
          "Class A rule",
          "Coverage",
          "Reason",
          "Gap",
          detailed ? "Relevant excerpt" : "Confirmation",
          "Additional evidence",
        ],
        rows,
      ),
    ),
    section(
      "SOC 2 exceptions",
      table(
        ["Exception", "Materiality", "Pages", "Description"],
        project.soc2.exceptions.map((item) => [
          item.title,
          label(item.materiality),
          item.pages.join(", "),
          item.description,
        ]),
      ),
    ),
  ].join("");
};

const scopeBody = (project: BridgeProject) => {
  const resources = project.scope.resources.map((resource) => [
    resource.name,
    label(resource.kind),
    resource.included ? "Included" : "Out of scope",
    resource.handlesFederalData ? "Yes" : "No",
    resource.affectsCia ? "Yes" : "No",
    resource.rationale,
    resource.needsTechnicalConfirmation ? "Needs technical confirmation" : "Confirmed",
  ]);
  const relationships = project.scope.relationships.map((relationship) => [
    project.scope.resources.find((resource) => resource.id === relationship.fromId)?.name ??
      relationship.fromId,
    label(relationship.kind),
    project.scope.resources.find((resource) => resource.id === relationship.toId)?.name ??
      relationship.toId,
    relationship.description,
  ]);
  return [
    section("Plain-language scope summary", `<p>${text(project.scope.summary)}</p>`),
    section("Basic data-flow summary", `<p>${text(project.scope.dataFlowSummary)}</p>`),
    section(
      "Included and excluded resources",
      table(
        ["Resource", "Type", "Treatment", "Federal data", "Affects CIA", "Rationale", "Review"],
        resources,
      ),
    ),
    section("Relationships", table(["From", "Relationship", "To", "Description"], relationships)),
    section("Questions requiring confirmation", list(project.scope.questions)),
    section("Potential scope mismatches", list(project.scope.mismatchFindings)),
  ].join("");
};

const requirementsBody = (project: BridgeProject, mandatoryOnly: boolean) => {
  if (mandatoryOnly) {
    return section(
      "Mandatory requirement records",
      table(
        [
          "Rule",
          "Official title",
          "Status",
          "Review",
          "Owner",
          "Open questions",
          "Evidence",
          "Catalog version",
          "Official source",
        ],
        RULE_SELECTIONS.mandatory.map((ruleId) => {
          const requirement = project.requirements.find((item) => item.ruleId === ruleId);
          const rule = getRule(ruleId);
          return [
            ruleId,
            ruleName(ruleId),
            requirement ? label(requirement.status) : "No project record",
            requirement ? label(requirement.reviewStatus) : "Unreviewed",
            requirement?.owner ?? "Unassigned",
            requirement?.openQuestions.join("; ") ?? "",
            requirement?.evidenceIds.length ?? 0,
            rule?.source.catalogVersion ?? project.metadata.ruleCatalogVersion,
            rule?.source.sourceUrl ?? "",
          ];
        }),
      ),
    );
  }
  return section(
    "Requirement gaps",
    table(
      ["Rule", "Official title", "Status", "Review", "Owner", "Open questions", "Evidence"],
      project.requirements.map((requirement) => [
        requirement.ruleId,
        ruleName(requirement.ruleId),
        label(requirement.status),
        label(requirement.reviewStatus),
        requirement.owner,
        requirement.openQuestions.join("; "),
        requirement.evidenceIds.length,
      ]),
    ),
  );
};

const evidenceBody = (project: BridgeProject) => {
  const today = project.metadata.updatedAt.slice(0, 10);
  return [
    callout(
      "Every listed item is an evidence candidate until a qualified reviewer confirms relevance, period, scope, and sufficiency.",
      "warning",
    ),
    section(
      "Evidence candidates",
      table(
        [
          "Title",
          "Type",
          "Owner",
          "Collected",
          "Review date",
          "Freshness",
          "Sensitivity",
          "Review status",
          "Requirements",
          "SHA-256",
        ],
        project.evidence.map((item) => [
          item.title,
          label(item.kind),
          item.owner,
          item.collectedAt,
          item.reviewDate ?? "",
          item.reviewDate && item.reviewDate < today ? "Review date passed" : "No stale flag",
          label(item.sensitivity),
          label(item.reviewStatus),
          item.relatedRequirementIds.join(", "),
          item.sha256,
        ]),
      ),
    ),
  ].join("");
};

const actionBody = (project: BridgeProject, openOnly: boolean) => {
  const actions = openOnly
    ? project.actions.filter((action) => action.status !== "done")
    : project.actions;
  const categories = [...new Set(actions.map((action) => action.category))];
  if (categories.length === 0) return '<p class="empty">No action items recorded.</p>';
  return categories
    .map((category) =>
      section(
        label(category),
        table(
          ["Action", "Description", "Priority", "Owner", "Due", "Status", "Next route"],
          actions
            .filter((action) => action.category === category)
            .map((action) => [
              action.title,
              action.description,
              label(action.priority),
              action.owner,
              action.dueDate ?? "",
              label(action.status),
              action.nextRoute,
            ]),
        ),
      ),
    )
    .join("");
};

const validationBody = (project: BridgeProject) => {
  const outputs = project.generatedOutputs.filter((output) => output.format === "json");
  return [
    section(
      "Generated JSON status",
      table(
        ["Document", "Generated", "Status", "Issues"],
        outputs.map((output) => [
          output.title,
          output.generatedAt,
          label(output.validationStatus),
          output.validationIssues.length,
        ]),
      ),
    ),
    section(
      "Validation issues",
      table(
        ["Document", "Affected field", "Explanation", "Edit route"],
        outputs.flatMap((output) =>
          output.validationIssues.map((issue) => [
            output.title,
            issue.pointer,
            issue.message,
            issue.route,
          ]),
        ),
      ),
    ),
  ].join("");
};

const materialsBody = (project: BridgeProject) =>
  section(
    "External assessment materials",
    table(
      ["Material", "Type", "Status", "Rationale", "Review date"],
      project.materials.map((material) => [
        material.title,
        label(material.kind),
        label(material.status),
        material.rationale,
        material.reviewDate ?? "",
      ]),
    ),
  );

const advisorBody = (project: BridgeProject) =>
  [
    callout(
      "This redacted report omits uploaded files, source-document metadata, excerpts, hashes, evidence details, narratives, and private notes. Review it before sharing.",
      "warning",
    ),
    section("Preliminary result", `<p>${text(project.eligibility.result?.label)}</p>`),
    section("Advisor-review flags", list(project.advisorFlags)),
    section("Open action summary", actionBody(project, true)),
  ].join("");

const providerApprovalBody = (project: BridgeProject) => {
  const approved = project.requirements.filter(isProviderApprovedRequirement);
  return [
    callout(
      "Provider approval records internal acceptance of representations. It does not constitute FedRAMP approval or submission.",
      "warning",
    ),
    section(
      "Provider-approved requirement records",
      table(
        ["Rule", "Approved by", "Approved at", "Review status"],
        approved.map((requirement) => [
          requirement.ruleId,
          requirement.providerApprovedBy ?? "",
          requirement.providerApprovedAt ?? "",
          label(requirement.reviewStatus),
        ]),
      ),
    ),
  ].join("");
};

function bodyFor(project: BridgeProject, kind: HumanReportKind): string {
  const determination = callout("This report is not a FedRAMP determination.", "warning");
  const body = (() => {
    switch (kind) {
      case "preliminary-fit":
        return resultBody(project);
      case "executive-readiness":
        return readinessBody(project);
      case "detailed-gap":
        return `${mappingsBody(project, true)}${requirementsBody(project, false)}`;
      case "soc2-mapping":
        return mappingsBody(project, true);
      case "scope-summary":
        return scopeBody(project);
      case "mandatory-requirements":
        return requirementsBody(project, true);
      case "evidence-manifest":
        return evidenceBody(project);
      case "action-plan":
        return actionBody(project, false);
      case "open-items":
        return actionBody(project, true);
      case "package-validation":
        return validationBody(project);
      case "external-materials":
        return materialsBody(project);
      case "advisor-handoff":
        return advisorBody(project);
      case "provider-approval":
        return providerApprovalBody(project);
    }
  })();
  return `${determination}${body}`;
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

function htmlToPlainText(value: string): string {
  return decodeEntities(
    value
      .replaceAll(/<style[\s\S]*?<\/style>/giu, "")
      .replaceAll(/<\/(?:h[1-6]|p|li|tr|section|div|header|footer)>/giu, "\n")
      .replaceAll(/<br\s*\/?>/giu, "\n")
      .replaceAll(/<[^>]+>/gu, " ")
      .replaceAll(/[ \t]+/gu, " ")
      .replaceAll(/\n\s+/gu, "\n")
      .replaceAll(/\n{3,}/gu, "\n\n")
      .trim(),
  );
}

export function generateHumanReport(
  project: BridgeProject,
  kind: HumanReportKind,
  options: GenerationOptions = {},
): HumanReport {
  if (kind === "advisor-handoff") {
    return createAdvisorHandoff(project, options).report;
  }
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const title = TITLES[kind];
  const body = bodyFor(project, kind);
  const html = renderStandaloneHtml({
    title,
    organization: project.organization.name,
    offering: project.offering.name,
    generatedAt,
    body,
    ...(project.metadata.watermark ? { watermark: project.metadata.watermark } : {}),
  });
  return {
    kind,
    title,
    fileName: `${slug(project.organization.name || "provider")}-${slug(title)}.html`,
    generatedAt,
    mimeType: "text/html;charset=utf-8",
    html,
    plainText: htmlToPlainText(html),
    ...(project.metadata.watermark ? { watermark: project.metadata.watermark } : {}),
    pdfInstructions: PRINT_PDF_INSTRUCTIONS,
  };
}
