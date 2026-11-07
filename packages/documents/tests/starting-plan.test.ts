import { expect, it } from "vitest";
import { createEmptyProject, evaluateEligibility } from "@class-a-bridge/project";
import { CATALOG_MANIFEST } from "@class-a-bridge/rules";
import { generateHumanReport, generatePreparationPackage } from "../src/index";

it("exports full questions, actionable tasks and explicit source provenance", () => {
  const project = createEmptyProject("<script>Example</script>", "Example & team");
  const answers = {
    soc2_type_ii: "yes",
    soc2_fresh: "yes",
    product_match: "yes",
    federal_differs: "no",
    carved_out: "yes",
    material_exceptions: "no",
    cloud_service: "yes",
    federal_use_case: "yes",
  } as const;
  project.eligibility.answers = Object.entries(answers).map(([questionId, value]) => ({
    questionId: questionId as keyof typeof answers,
    value,
    answeredAt: new Date().toISOString(),
  }));
  project.eligibility.result = evaluateEligibility(answers);
  const { html } = generateHumanReport(project, "preliminary-fit");
  expect(html).toContain(
    "Will the federal offering differ materially from the audited commercial product?",
  );
  expect(html).toContain("Compliance and cloud operations");
  expect(html).toContain("Completion condition");
  expect(html).toContain(CATALOG_MANIFEST.catalogVersion);
  expect(html).toContain(CATALOG_MANIFEST.verifiedAt);
  expect(html).toContain("Draft guidance");
  expect(html).not.toContain("Resolve the highest-impact uncertain answer");
  expect(html).toContain("Example &amp; team");
});

it("requires an explicit catalog update before generating a new package from a July project", async () => {
  const project = createEmptyProject("Historical", "Example");
  project.metadata.ruleCatalogVersion = "2026.07.14.01";
  await expect(generatePreparationPackage(project)).rejects.toThrow(/catalog update/iu);
});
