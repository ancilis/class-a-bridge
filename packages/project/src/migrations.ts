import { z } from "zod";

import {
  BridgeProjectSchema,
  PROJECT_SCHEMA_VERSION,
  SOC2_REVIEW_OUTCOME_COVERAGE,
  SOC2_SUPPORTING_REVIEW_OUTCOMES,
  createEmptyProject,
  type BridgeProject,
} from "./model";

const LegacyProjectSchema = z
  .object({ schemaVersion: z.literal(0), projectName: z.string(), organizationName: z.string() })
  .strict();

const LegacyV1ProjectSchema = z
  .object({
    metadata: z
      .object({
        schemaVersion: z.literal(1),
        migrations: z.array(z.unknown()),
      })
      .passthrough(),
    mappings: z.array(z.record(z.string(), z.unknown())),
    soc2: z
      .object({
        controls: z.array(z.record(z.string(), z.unknown())),
      })
      .passthrough(),
  })
  .passthrough();

function migrateV1Project(input: unknown): BridgeProject | undefined {
  const parsed = LegacyV1ProjectSchema.safeParse(input);
  if (!parsed.success) return undefined;
  const project = structuredClone(parsed.data) as unknown as Record<string, unknown> & {
    metadata: Record<string, unknown> & { migrations: unknown[] };
    mappings: Record<string, unknown>[];
    soc2: { controls: Record<string, unknown>[] };
  };
  project.metadata.schemaVersion = PROJECT_SCHEMA_VERSION;
  project.metadata.migrations.push({
    id: "v1-to-v2-mapping-review-provenance",
    from: 1,
    to: PROJECT_SCHEMA_VERSION,
    appliedAt: new Date().toISOString(),
  });
  for (const mapping of project.mappings) {
    const outcome = mapping["reviewOutcome"];
    const hasOutcome = typeof outcome === "string";
    if (hasOutcome && outcome in SOC2_REVIEW_OUTCOME_COVERAGE) {
      mapping["coverage"] =
        SOC2_REVIEW_OUTCOME_COVERAGE[outcome as keyof typeof SOC2_REVIEW_OUTCOME_COVERAGE];
    }
    if (mapping["confirmed"] !== true) continue;
    const hasReviewer =
      typeof mapping["reviewer"] === "string" && mapping["reviewer"].trim().length > 0;
    const hasReviewDate = typeof mapping["reviewDate"] === "string";
    if (hasOutcome && hasReviewer && hasReviewDate) continue;
    mapping["confirmed"] = false;
    if (!hasOutcome) {
      mapping["reviewOutcome"] = "needs_expert_review";
      mapping["coverage"] = SOC2_REVIEW_OUTCOME_COVERAGE.needs_expert_review;
    }
    const missingInformation = Array.isArray(mapping["missingInformation"])
      ? mapping["missingInformation"].filter((item): item is string => typeof item === "string")
      : [];
    mapping["missingInformation"] = [
      ...new Set([...missingInformation, "Reconfirm this mapping after the project migration."]),
    ];
  }
  for (const control of project.soc2.controls) {
    if (control["confirmationStatus"] !== "confirmed") continue;
    const hasReviewer =
      typeof control["reviewer"] === "string" && control["reviewer"].trim().length > 0;
    const hasReviewDate = typeof control["reviewDate"] === "string";
    if (!hasReviewer || !hasReviewDate) control["confirmationStatus"] = "unreviewed";
  }
  const reviewedControlIds = new Set(
    project.soc2.controls
      .filter(
        (control) =>
          control["confirmationStatus"] === "confirmed" &&
          typeof control["reviewer"] === "string" &&
          control["reviewer"].trim().length > 0 &&
          typeof control["reviewDate"] === "string",
      )
      .map((control) => control["id"])
      .filter((id): id is string => typeof id === "string"),
  );
  for (const mapping of project.mappings) {
    const controlId = mapping["soc2ControlId"];
    if (
      mapping["confirmed"] === true &&
      SOC2_SUPPORTING_REVIEW_OUTCOMES.some((outcome) => outcome === mapping["reviewOutcome"]) &&
      (typeof controlId !== "string" || !reviewedControlIds.has(controlId))
    ) {
      mapping["confirmed"] = false;
      const missingInformation = Array.isArray(mapping["missingInformation"])
        ? mapping["missingInformation"].filter((item): item is string => typeof item === "string")
        : [];
      mapping["missingInformation"] = [
        ...new Set([
          ...missingInformation,
          "Review the source SOC 2 control before reconfirming this supporting mapping.",
        ]),
      ];
    }
  }
  return BridgeProjectSchema.parse(project);
}

export function migrateProject(input: unknown): BridgeProject {
  const current = BridgeProjectSchema.safeParse(input);
  if (current.success) return current.data;
  const migratedV1 = migrateV1Project(input);
  if (migratedV1) return migratedV1;
  const legacy = LegacyProjectSchema.parse(input);
  const project = createEmptyProject(legacy.projectName, legacy.organizationName);
  project.metadata.migrations.push({
    id: `v0-to-v${PROJECT_SCHEMA_VERSION}`,
    from: 0,
    to: PROJECT_SCHEMA_VERSION,
    appliedAt: new Date().toISOString(),
  });
  return BridgeProjectSchema.parse(project);
}
