import { expect, it } from "vitest";
import {
  CATALOG_MANIFEST,
  RULE_SELECTIONS,
  RULE_REGISTRY,
  SOC2_MAPPING_PLAYBOOKS,
} from "../src/index";

it("uses the reviewed November catalog with the corrected Class A selections", () => {
  expect(CATALOG_MANIFEST.catalogVersion).toBe("2026.11.02.01");
  expect(RULE_SELECTIONS.mandatory).toContain("SDR-CSX-KSI");
  expect(RULE_SELECTIONS.mandatory).toHaveLength(24);
  expect(RULE_SELECTIONS.recommended).not.toContain("CPO-CSF-CPM");
  expect(RULE_REGISTRY.some((rule) => rule.id === "CPO-CSF-CPM")).toBe(false);
  expect(
    SOC2_MAPPING_PLAYBOOKS.find((rule) => rule.ruleId === "SDR-CSX-KSI")?.requirementSummary,
  ).toMatch(/measures|summaries/iu);
});
