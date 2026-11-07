import { CATALOG_MANIFEST, RULE_REGISTRY } from "@class-a-bridge/rules";
import { BridgeProjectSchema, createEmptyProject, type BridgeProject } from "./model";
import { evaluateEligibility } from "./eligibility";

/** Explicit user action: preserve historical snapshots, require current work to be reviewed again. */
export function upgradeProjectCatalog(input: BridgeProject): BridgeProject {
  const project = BridgeProjectSchema.parse(structuredClone(input));
  if (project.metadata.ruleCatalogVersion === CATALOG_MANIFEST.catalogVersion) return project;
  const priorVersion = project.metadata.ruleCatalogVersion;
  const mandatory = createEmptyProject(
    project.metadata.name,
    project.organization.name,
  ).requirements;
  const currentIds = new Set(RULE_REGISTRY.map((rule) => rule.id));
  for (const requirement of project.requirements) {
    if (!currentIds.has(requirement.ruleId)) continue;
    if (requirement.status !== "not_started") requirement.status = "needs_expert_review";
    requirement.reviewStatus = "unreviewed";
    requirement.openQuestions.push(
      `Review this record against catalog ${CATALOG_MANIFEST.catalogVersion}; previous work used ${priorVersion}.`,
    );
  }
  for (const requirement of mandatory) {
    if (!project.requirements.some((row) => row.ruleId === requirement.ruleId))
      project.requirements.push(requirement);
  }
  for (const mapping of project.mappings) {
    mapping.confirmed = false;
    mapping.missingInformation = [
      ...new Set([
        ...(mapping.missingInformation ?? []),
        "Reconfirm this mapping against the updated rule catalog.",
      ]),
    ];
  }
  project.metadata.ruleCatalogVersion = CATALOG_MANIFEST.catalogVersion;
  project.metadata.updatedAt = new Date().toISOString();
  if (project.eligibility.answers.length === 8) {
    if (project.eligibility.result)
      project.eligibility.history.push(structuredClone(project.eligibility.result));
    project.eligibility.result = evaluateEligibility(
      Object.fromEntries(
        project.eligibility.answers.map((answer) => [answer.questionId, answer.value]),
      ),
    );
  }
  // Existing package records and approvals remain historical; fresh review uses a new project hash.
  for (const action of project.actions) {
    if (action.origin === "generated") action.status = "open";
  }
  return BridgeProjectSchema.parse(project);
}
