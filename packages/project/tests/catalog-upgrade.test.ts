import { expect, it } from "vitest";
import {
  BridgeProjectSchema,
  createEmptyProject,
  migrateProject,
  upgradeProjectCatalog,
  exportProjectBundle,
  importProjectBundle,
  finalReviewApprovalScope,
} from "../src/index";

const julyProject = () => {
  const project = createEmptyProject("Existing July project", "Example");
  project.generatedOutputs.push({
    id: "historical-package",
    kind: "preparation_package",
    title: "Historical package",
    format: "zip",
    generatedAt: "2026-07-17T00:00:00.000Z",
    sha256: "b".repeat(64),
    validationStatus: "valid",
    validationIssues: [],
  });
  const snapshot = {
    id: "historical-snapshot",
    version: "1.0",
    createdAt: "2026-07-17T00:00:00.000Z",
    providerApprover: "Fictional reviewer",
    verificationDate: "2026-07-17",
    validationDate: "2026-07-17",
    projectHash: "a".repeat(64),
    packageHash: "b".repeat(64),
    freshnessStatus: "needs_confirmation" as const,
    unresolvedItems: ["Historical open item"],
    immutable: true as const,
  };
  project.snapshots.push(snapshot);
  project.approvals.push({
    id: "historical-approval",
    kind: "final_internal_review",
    title: "Historical approval",
    approver: snapshot.providerApprover,
    role: "Provider approver",
    acceptedAt: "2026-07-17T01:00:00.000Z",
    scope: finalReviewApprovalScope(snapshot),
    notes: "Not approval under a new catalog.",
  });
  const legacy = {
    ...project,
    metadata: { ...project.metadata, ruleCatalogVersion: "2026.07.14.01" },
    requirements: project.requirements.filter((row) => row.ruleId !== "SDR-CSX-KSI"),
  };
  legacy.requirements.push({
    ...legacy.requirements[0]!,
    ruleId: "CPO-CSF-CPM",
    notes: "Historical work must survive.",
  });
  legacy.requirements[0]!.implementationNarrative = "Existing implementation";
  legacy.requirements[0]!.status = "complete_for_internal_review";
  return legacy;
};

it("reads and round-trips July projects without silently rewriting their baseline", async () => {
  const input = julyProject();
  const parsed = migrateProject(input);
  expect(parsed.metadata.ruleCatalogVersion).toBe("2026.07.14.01");
  const bundle = await exportProjectBundle(parsed);
  const restored = await importProjectBundle(bundle);
  expect(restored.project).toEqual(parsed);
});

it("explicitly reconciles the catalog while retaining narratives and historical records", () => {
  const input = migrateProject(julyProject());
  const updated = upgradeProjectCatalog(input);
  expect(input.metadata.ruleCatalogVersion).toBe("2026.07.14.01");
  expect(updated.metadata.ruleCatalogVersion).toBe("2026.11.02.01");
  expect(updated.requirements.find((row) => row.ruleId === "SDR-CSX-KSI")?.status).toBe(
    "not_started",
  );
  expect(updated.requirements[0]?.implementationNarrative).toBe("Existing implementation");
  expect(updated.requirements[0]?.status).toBe("needs_expert_review");
  expect(updated.requirements.find((row) => row.ruleId === "CPO-CSF-CPM")?.notes).toContain(
    "Historical work",
  );
  expect(updated.snapshots).toEqual(input.snapshots);
  expect(updated.approvals).toEqual(input.approvals);
  expect(BridgeProjectSchema.parse(updated)).toEqual(updated);
  expect(upgradeProjectCatalog(updated)).toEqual(updated);
});

it("rejects unknown catalog versions and missing current mandatory records", () => {
  const input = createEmptyProject("Current", "Example");
  expect(() =>
    BridgeProjectSchema.parse({
      ...input,
      metadata: { ...input.metadata, ruleCatalogVersion: "2099.01.01.01" },
    }),
  ).toThrow();
  input.requirements = input.requirements.filter((row) => row.ruleId !== "SDR-CSX-KSI");
  expect(() => BridgeProjectSchema.parse(input)).toThrow(/SDR-CSX-KSI/iu);
});
