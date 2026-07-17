import { describe, expect, it } from "vitest";

import { ELIGIBILITY_QUESTIONS, evaluateEligibility } from "../src/index";

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

describe("preliminary eligibility", () => {
  it("uses exactly eight high-value guided questions", () => {
    expect(ELIGIBILITY_QUESTIONS).toHaveLength(8);
    for (const question of ELIGIBILITY_QUESTIONS) {
      expect(question).toEqual(
        expect.objectContaining({
          why: expect.any(String),
          example: expect.any(String),
          strongAnswer: expect.any(String),
          owner: expect.any(String),
        }),
      );
    }
  });

  it("returns a likely fit with traceable reasons and exactly three actions", () => {
    const result = evaluateEligibility(strong);
    expect(result.classification).toBe("likely_fit");
    expect(result.recommendedActions).toHaveLength(3);
    expect(result.supportingAnswerIds).toHaveLength(8);
    expect(result.findings.every((finding) => finding.method === "deterministic")).toBe(true);
    expect(result.disclaimer).toMatch(/not a FedRAMP determination/iu);
  });

  it("classifies stale or non-Type-II starting points as not currently eligible", () => {
    expect(evaluateEligibility({ ...strong, soc2_type_ii: "no" }).classification).toBe(
      "not_currently_eligible",
    );
    expect(evaluateEligibility({ ...strong, soc2_fresh: "no" }).classification).toBe(
      "not_currently_eligible",
    );
  });

  it("surfaces scope mismatches and uncertainty without unsupported positives", () => {
    expect(evaluateEligibility({ ...strong, product_match: "no" }).classification).toBe(
      "potential_scope_mismatch",
    );
    expect(evaluateEligibility({ ...strong, federal_differs: "yes" }).classification).toBe(
      "potential_scope_mismatch",
    );
    const uncertain = evaluateEligibility({ ...strong, carved_out: "not_sure" });
    expect(uncertain.classification).toBe("needs_expert_review");
    expect(uncertain.missingInformation.length).toBeGreaterThan(0);
    expect(uncertain.findings[0]).toEqual(
      expect.objectContaining({
        answerRefs: expect.any(Array),
        ruleRefs: expect.any(Array),
        evidenceNeeded: expect.any(Array),
        humanReview: true,
      }),
    );
  });
});
