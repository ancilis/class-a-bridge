import {
  BridgeProjectSchema,
  soc2MappingSupportsReuse,
  suggestSoc2Mappings,
} from "@class-a-bridge/project";
import { RULE_REGISTRY } from "@class-a-bridge/rules";
import { describe, expect, it } from "vitest";

import { ACME_METRICS_PROJECT, SAMPLE_WATERMARK } from "../src/index";

describe("Acme Metrics fictional workspace", () => {
  it("is complete, valid, mixed-state, and unmistakably fictional", () => {
    expect(BridgeProjectSchema.parse(ACME_METRICS_PROJECT)).toEqual(ACME_METRICS_PROJECT);
    expect(ACME_METRICS_PROJECT.metadata.isSample).toBe(true);
    expect(ACME_METRICS_PROJECT.metadata.watermark).toBe(SAMPLE_WATERMARK);
    expect(ACME_METRICS_PROJECT.requirements.length).toBeGreaterThanOrEqual(23);
    expect(new Set(ACME_METRICS_PROJECT.requirements.map((item) => item.ruleId))).toEqual(
      new Set(RULE_REGISTRY.map((item) => item.id)),
    );
    expect(
      new Set(ACME_METRICS_PROJECT.requirements.map((item) => item.status)).size,
    ).toBeGreaterThan(2);
    expect(
      ACME_METRICS_PROJECT.requirements.filter(
        (item) => item.ruleId.startsWith("KSI-") && item.implementationNarrative,
      ),
    ).toHaveLength(7);
    expect(ACME_METRICS_PROJECT.evidence.length).toBeGreaterThan(2);
    expect(ACME_METRICS_PROJECT.actions.length).toBeGreaterThan(2);
    expect(ACME_METRICS_PROJECT.advisorFlags.length).toBeGreaterThan(0);
    expect(ACME_METRICS_PROJECT.packageInputs.certificationPackageOverview).toEqual(
      expect.objectContaining({
        logoUrl: expect.stringMatching(/^https:\/\//u),
        businessCategories: ["Analytics"],
      }),
    );
    expect(
      ACME_METRICS_PROJECT.packageInputs.certificationPackageOverview.securityContact.phone,
    ).toMatch(/^\d{3}-\d{3}-\d{4}$/u);
    expect(
      ACME_METRICS_PROJECT.packageInputs.securityDecisionRecord.certificationPackageOverviewUri,
    ).toMatch(/^https:\/\//u);
  });

  it("demonstrates the control-inventory judgments that govern SOC 2 reuse", () => {
    const controls = ACME_METRICS_PROJECT.soc2.controls;
    expect(controls).toHaveLength(7);
    const confirmationStatuses = new Set(
      controls.map(({ confirmationStatus }) => confirmationStatus),
    );
    expect(confirmationStatuses.has("confirmed")).toBe(true);
    expect(confirmationStatuses.has("unreviewed")).toBe(true);
    expect(controls.find(({ id }) => id === "ACME-CC6.1")).toEqual(
      expect.objectContaining({
        exceptionStatus: "exception_reported",
        remediationStatus: "in_progress",
        complementaryUserEntityControl:
          "Customers approve administrators and review their access quarterly.",
      }),
    );
    expect(controls.find(({ id }) => id === "ACME-CC9.2")).toEqual(
      expect.objectContaining({
        treatment: "carve_out",
        subserviceOrganization: "Fictional Cloud Host",
        complementarySubserviceOrganizationControl:
          "The fictional host restricts and reviews privileged infrastructure access.",
      }),
    );
    expect(
      controls.some(({ sourceSuggestions }) =>
        sourceSuggestions?.some(
          ({ decision, extractionBasis, sourceExcerpt, sourcePage }) =>
            decision === "unreviewed" &&
            extractionBasis.length > 0 &&
            sourceExcerpt.length > 0 &&
            sourcePage > 0,
        ),
      ),
    ).toBe(true);
  });

  it("contains strong, partial, rejected, conflicting, and expert-review mapping records", () => {
    const outcomes = new Set(
      ACME_METRICS_PROJECT.mappings.map(({ reviewOutcome }) => reviewOutcome),
    );
    for (const outcome of [
      "confirmed_supporting_material",
      "partial_support",
      "rejected_mapping",
      "scope_mismatch",
      "period_mismatch",
      "exception_affects_reuse",
      "fedramp_specific_work_required",
      "needs_expert_review",
    ] as const) {
      expect(outcomes.has(outcome), outcome).toBe(true);
    }
    expect(
      ACME_METRICS_PROJECT.mappings.some(
        ({ coverage, reviewOutcome }) =>
          coverage === "fedramp_specific_work_required" &&
          reviewOutcome === "fedramp_specific_work_required",
      ),
    ).toBe(true);
    expect(ACME_METRICS_PROJECT.advisorFlags.join(" ")).toMatch(
      /mapping|exception|carve-out|scope/iu,
    );
  });

  it("keeps mapping provenance authoritative across requirements and evidence", () => {
    const controls = new Set(ACME_METRICS_PROJECT.soc2.controls.map(({ id }) => id));
    const requirements = new Map(
      ACME_METRICS_PROJECT.requirements.map((requirement) => [requirement.ruleId, requirement]),
    );
    const evidence = new Map(ACME_METRICS_PROJECT.evidence.map((item) => [item.id, item]));

    for (const mapping of ACME_METRICS_PROJECT.mappings) {
      expect(controls.has(mapping.soc2ControlId)).toBe(true);
      expect(requirements.has(mapping.classARuleId)).toBe(true);
      for (const evidenceId of mapping.evidenceIds ?? []) {
        const item = evidence.get(evidenceId);
        expect(item, evidenceId).toBeDefined();
        expect(item?.relatedSoc2ControlIds).toContain(mapping.soc2ControlId);
        expect(item?.relatedRequirementIds).toContain(mapping.classARuleId);
      }

      const requirement = requirements.get(mapping.classARuleId)!;
      const accepted = soc2MappingSupportsReuse(mapping);
      expect(requirement.soc2ControlIds.includes(mapping.soc2ControlId)).toBe(accepted);
      expect(requirement.soc2PageReferences.includes(mapping.reportPage)).toBe(accepted);
    }
  });

  it("produces explainable strong and conflicting suggestions without auto-confirmation", () => {
    const suggestions = suggestSoc2Mappings(ACME_METRICS_PROJECT);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every(({ confirmed }) => confirmed === false)).toBe(true);
    expect(suggestions).toContainEqual(
      expect.objectContaining({
        soc2ControlId: "ACME-CC6.6",
        classARuleId: "KSI-CNA-RNT",
        suggestionLevel: "strong_candidate",
        scopeAlignment: "aligned",
        periodAlignment: "aligned",
      }),
    );
    expect(suggestions).toContainEqual(
      expect.objectContaining({
        soc2ControlId: "ACME-CC4.2-PRIOR",
        classARuleId: "IVV-CSX-AIA",
        suggestionLevel: "potential_conflict",
        periodAlignment: "mismatch",
      }),
    );
    expect(suggestions).toContainEqual(
      expect.objectContaining({
        soc2ControlId: "ACME-CC9.2",
        classARuleId: "MAS-CSO-IIR",
        suggestionLevel: "expert_review_suggested",
      }),
    );
  });

  it("includes a complete, watermarked SOC 2 reuse report", () => {
    const report = ACME_METRICS_PROJECT.generatedOutputs.find(
      ({ kind }) => kind === "soc2_reuse_gap_report",
    );
    expect(report).toEqual(
      expect.objectContaining({
        format: "html",
        title: expect.stringContaining(SAMPLE_WATERMARK),
        content: expect.stringContaining(SAMPLE_WATERMARK),
      }),
    );
    expect(
      ACME_METRICS_PROJECT.generatedOutputs.every(
        ({ content, title }) =>
          title.includes(SAMPLE_WATERMARK) && content?.includes(SAMPLE_WATERMARK),
      ),
    ).toBe(true);
  });
});
