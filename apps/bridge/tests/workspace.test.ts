import { ACME_METRICS_PROJECT } from "@class-a-bridge/testing";
import { describe, expect, it } from "vitest";

import { deriveActions, initializeProject, soc2PackageFreshness } from "../src/lib/workspace";

const REFERENCE = new Date("2026-07-17T12:00:00.000Z");

describe("SOC 2 package freshness", () => {
  it.each([
    { reportDate: undefined, reportEnd: undefined, expected: "needs_confirmation" },
    { reportDate: "not-a-date", reportEnd: "2025-12-01", expected: "needs_confirmation" },
    { reportDate: "2026-07-18", reportEnd: "2026-06-01", expected: "needs_confirmation" },
    { reportDate: "2025-07-17", reportEnd: "2025-06-30", expected: "stale" },
    { reportDate: "2025-07-18", reportEnd: "2025-06-30", expected: "aging" },
    { reportDate: "2025-08-16", reportEnd: "2025-06-30", expected: "aging" },
    { reportDate: "2025-08-17", reportEnd: "2025-06-30", expected: "fresh" },
    { reportDate: undefined, reportEnd: "2026-01-15", expected: "fresh" },
  ])("returns $expected for report date $reportDate and end $reportEnd", (fixture) => {
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.soc2.reportDate = fixture.reportDate;
    project.soc2.reportEnd = fixture.reportEnd;
    project.evidence = project.evidence.map((item) => ({ ...item, reviewDate: "2027-01-01" }));
    expect(soc2PackageFreshness(project, REFERENCE)).toBe(fixture.expected);
  });

  it("treats the recorded eligibility answer and evidence review dates conservatively", () => {
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.soc2.reportDate = "2026-06-01";
    project.evidence = project.evidence.map((item) => ({ ...item, reviewDate: "2027-01-01" }));

    project.eligibility.answers = project.eligibility.answers.filter(
      (answer) => answer.questionId !== "soc2_fresh",
    );
    expect(soc2PackageFreshness(project, REFERENCE)).toBe("needs_confirmation");

    project.eligibility.answers.push({
      questionId: "soc2_fresh",
      value: "no",
      answeredAt: "2026-07-17T12:00:00.000Z",
    });
    expect(soc2PackageFreshness(project, REFERENCE)).toBe("stale");

    project.eligibility.answers.at(-1)!.value = "yes";
    project.evidence[0]!.reviewDate = "2026-07-16";
    expect(soc2PackageFreshness(project, REFERENCE)).toBe("stale");
  });
});

describe("generated action plan", () => {
  it("can represent every required action-plan category", () => {
    const project = initializeProject();
    project.eligibility.result = structuredClone(ACME_METRICS_PROJECT.eligibility.result);
    project.scope.mismatchFindings = ["Confirm the proposed boundary."];
    project.evidence = [structuredClone(ACME_METRICS_PROJECT.evidence[0]!)];
    delete project.organization.accountableExecutive;
    project.requirements.find((item) => item.ruleId === "MAS-CSO-IIR")!.status =
      "needs_technical_confirmation";

    const categories = new Set(deriveActions(project).map((item) => item.category));

    expect(categories).toEqual(
      new Set([
        "eligibility_blockers",
        "scope_blockers",
        "before_application_preparation",
        "missing_implementation",
        "missing_evidence",
        "technical_confirmation",
        "executive_approval",
        "recommended_improvements",
        "optional_enhancements",
      ]),
    );
  });

  it("preserves provider-authored actions when generated findings are refreshed", () => {
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.actions.push({
      id: "scope-custom",
      origin: "provider",
      title: "Provider-authored scope follow-up",
      description: "Keep this action even though its identifier resembles a generated action.",
      category: "scope_blockers",
      priority: "high",
      owner: "GRC",
      status: "open",
      sourceRefs: ["MAS-CSO-IIR"],
      nextRoute: "/scope",
    });

    const derived = deriveActions(project);

    expect(derived).toContainEqual(
      expect.objectContaining({
        id: "action-training",
        category: "recommended_improvements",
      }),
    );
    expect(derived).toContainEqual(
      expect.objectContaining({ id: "scope-custom", origin: "provider" }),
    );
  });
});
