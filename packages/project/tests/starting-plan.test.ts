import { describe, expect, it } from "vitest";
import { evaluateEligibility, getStartingActions } from "../src/index";

const strong = {
  soc2_type_ii: "yes",
  soc2_fresh: "yes",
  product_match: "yes",
  federal_differs: "no",
  carved_out: "no",
  material_exceptions: "no",
  cloud_service: "yes",
  federal_use_case: "yes",
} as const;

describe("actionable starting plan", () => {
  it("gives a carve-out task without inventing uncertainty or exceptions", () => {
    const answers = { ...strong, carved_out: "yes" } as const;
    const result = evaluateEligibility(answers);
    expect(result.missingInformation).toEqual([]);
    expect(result.recommendedActions.join(" ")).not.toMatch(/uncertain answer|exceptions/iu);
    const tasks = getStartingActions(answers);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({ id: "carved_out", route: "/scope" });
    expect(tasks[0]?.evidence).toMatch(/provider|responsibilit/iu);
    expect(tasks[0]?.doneWhen).toMatch(/review|document/iu);
  });

  it("makes every unknown answer independently actionable", () => {
    for (const id of Object.keys(strong)) {
      const tasks = getStartingActions({ ...strong, [id]: "not_sure" });
      expect(tasks[0]?.id).toBe(id);
      expect(tasks[0]?.title).toMatch(/Confirm/iu);
      for (const task of tasks) {
        expect(task.owner.length).toBeGreaterThan(5);
        expect(task.evidence.length).toBeGreaterThan(20);
        expect(task.doneWhen.length).toBeGreaterThan(20);
        expect(task.ruleRefs.length).toBeGreaterThan(0);
      }
    }
  });

  it("scopes a non-SOC-2 starting point to this tool instead of universal ineligibility", () => {
    const result = evaluateEligibility({ ...strong, soc2_type_ii: "no" });
    expect(result.label).toMatch(/SOC 2.*path/iu);
    expect(result.summary).toMatch(/GovRAMP|Rev5/iu);
    expect(result.summary).not.toMatch(/not currently eligible/iu);
  });

  it("prioritizes concrete starting blockers ahead of less consequential uncertainty", () => {
    const tasks = getStartingActions({ ...strong, soc2_fresh: "no", federal_use_case: "not_sure" });
    expect(tasks[0]?.id).toBe("soc2_fresh");
    expect(tasks.map((task) => task.id)).toContain("federal_use_case");
    expect(new Set(tasks.map((task) => task.id)).size).toBe(3);
  });
});
