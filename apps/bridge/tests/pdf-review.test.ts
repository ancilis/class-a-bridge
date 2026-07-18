import { describe, expect, it } from "vitest";

import {
  applyExtractionCandidateDecision,
  updateExtractionCandidateValue,
} from "../src/features/soc2/pdf-review";
import { initializeProject } from "../src/lib/workspace";

const addCandidate = (
  field: string,
  value: string,
  id = `candidate-${field.toLowerCase().replaceAll(" ", "-")}`,
) => {
  const project = initializeProject("2026-07-18T12:00:00.000Z");
  project.soc2.extractionCandidates.push({
    id,
    field,
    value,
    page: 42,
    snippet: `Fictional source text for ${field}.`,
    confidence: "low",
    detector: "deterministic local pattern",
    decision: "unreviewed",
  });
  return project;
};

describe("local PDF extraction review decisions", () => {
  it("turns a confirmed control identifier into an unreviewed inventory draft with provenance", () => {
    const project = addCandidate("Control identifier", "ACME-CC6.1");

    applyExtractionCandidateDecision(
      project,
      project.soc2.extractionCandidates[0]!.id,
      "confirmed",
    );

    expect(project.soc2.controls).toContainEqual(
      expect.objectContaining({
        id: "ACME-CC6.1",
        reportPages: [42],
        confirmationStatus: "unreviewed",
        excerpt: "Fictional source text for Control identifier.",
        sourceSuggestions: [
          expect.objectContaining({
            field: "Control identifier",
            sourcePage: 42,
            decision: "confirmed",
          }),
        ],
      }),
    );
  });

  it("creates one reviewable auditor-exception draft and does not duplicate it", () => {
    const project = addCandidate("Auditor exception", "One access removal was delayed.");
    const candidateId = project.soc2.extractionCandidates[0]!.id;

    applyExtractionCandidateDecision(project, candidateId, "confirmed");
    applyExtractionCandidateDecision(project, candidateId, "confirmed");

    expect(project.soc2.exceptions).toEqual([
      expect.objectContaining({
        title: "Extracted auditor exception — needs review",
        description: "One access removal was delayed.",
        materiality: "not_sure",
        pages: [42],
      }),
    ]);
  });

  it("does not apply ignored suggestions to confirmed report fields", () => {
    const project = addCandidate("Report issuer", "Fictional Auditor LLP");

    applyExtractionCandidateDecision(project, project.soc2.extractionCandidates[0]!.id, "ignored");

    expect(project.soc2.issuer).toBe("");
    expect(project.soc2.extractionCandidates[0]!.decision).toBe("ignored");
  });

  it("leaves an empty non-ignore decision unreviewed", () => {
    const project = addCandidate("Report issuer", "   ");

    applyExtractionCandidateDecision(project, project.soc2.extractionCandidates[0]!.id, "edited");

    expect(project.soc2.extractionCandidates[0]!.decision).toBe("unreviewed");
    expect(project.soc2.issuer).toBe("");
  });

  it("invalidates an earlier decision when the suggested value changes", () => {
    const project = addCandidate("Report issuer", "Original Fictional Auditor LLP");
    const candidateId = project.soc2.extractionCandidates[0]!.id;
    applyExtractionCandidateDecision(project, candidateId, "confirmed");

    updateExtractionCandidateValue(project, candidateId, "Edited Fictional Auditor LLP");

    expect(project.soc2.extractionCandidates[0]).toMatchObject({
      value: "Edited Fictional Auditor LLP",
      decision: "unreviewed",
    });
    expect(project.soc2.issuer).toBe("Original Fictional Auditor LLP");
  });

  it("reconciles a corrected scalar and restores its prior value when ignored", () => {
    const project = addCandidate("Report issuer", "Original Fictional Auditor LLP");
    const candidateId = project.soc2.extractionCandidates[0]!.id;
    applyExtractionCandidateDecision(project, candidateId, "confirmed");
    updateExtractionCandidateValue(project, candidateId, "Corrected Fictional Auditor LLP");
    applyExtractionCandidateDecision(project, candidateId, "edited");
    expect(project.soc2.issuer).toBe("Corrected Fictional Auditor LLP");

    applyExtractionCandidateDecision(project, candidateId, "ignored");
    expect(project.soc2.issuer).toBe("");
  });

  it("updates and removes the deterministic auditor-exception draft", () => {
    const project = addCandidate("Auditor exception", "One access removal was delayed.");
    const candidateId = project.soc2.extractionCandidates[0]!.id;
    applyExtractionCandidateDecision(project, candidateId, "confirmed");
    updateExtractionCandidateValue(project, candidateId, "Two access removals were delayed.");
    applyExtractionCandidateDecision(project, candidateId, "edited");
    expect(project.soc2.exceptions[0]?.description).toBe("Two access removals were delayed.");

    applyExtractionCandidateDecision(project, candidateId, "ignored");
    expect(project.soc2.exceptions).toEqual([]);
  });

  it("renames an extracted control and its references when the identifier is corrected", () => {
    const project = addCandidate("Control identifier", "ACME-CC6.1");
    const candidateId = project.soc2.extractionCandidates[0]!.id;
    applyExtractionCandidateDecision(project, candidateId, "confirmed");
    project.requirements[0]!.soc2ControlIds.push("ACME-CC6.1");
    updateExtractionCandidateValue(project, candidateId, "ACME-CC6.2");
    applyExtractionCandidateDecision(project, candidateId, "edited");

    expect(project.soc2.controls.map(({ id }) => id)).toContain("ACME-CC6.2");
    expect(project.soc2.controls.map(({ id }) => id)).not.toContain("ACME-CC6.1");
    expect(project.requirements[0]!.soc2ControlIds).toContain("ACME-CC6.2");
  });

  it("replaces and removes list values contributed by a suggestion", () => {
    const project = addCandidate("Trust Services Criteria", "Security");
    const candidateId = project.soc2.extractionCandidates[0]!.id;
    applyExtractionCandidateDecision(project, candidateId, "confirmed");
    updateExtractionCandidateValue(project, candidateId, "Availability");
    applyExtractionCandidateDecision(project, candidateId, "edited");
    expect(project.soc2.trustServicesCriteria).toEqual(["Availability"]);

    applyExtractionCandidateDecision(project, candidateId, "ignored");
    expect(project.soc2.trustServicesCriteria).toEqual([]);
  });

  it("replaces a superseded Type II claim when the corrected value is another report type", () => {
    const project = addCandidate("SOC 2 report type", "SOC 2 Type II");
    const candidateId = project.soc2.extractionCandidates[0]!.id;
    applyExtractionCandidateDecision(project, candidateId, "confirmed");
    updateExtractionCandidateValue(project, candidateId, "SOC 2 Type I");
    applyExtractionCandidateDecision(project, candidateId, "edited");

    expect(project.soc2.confirmedType).toBe("other");
    expect(project.soc2.extractionCandidates[0]?.decision).toBe("edited");
  });

  it("keeps an existing target control and reconciles duplicate mapping pairs", () => {
    const project = addCandidate("Control identifier", "EXTRACTED-CC6.1");
    const candidateId = project.soc2.extractionCandidates[0]!.id;
    applyExtractionCandidateDecision(project, candidateId, "confirmed");
    project.soc2.controls.push({
      id: "EXISTING-CC6.1",
      title: "Existing manual control",
      trustServicesCriteria: ["CC6.1"],
      reportPages: [21],
      auditorTest: "Manual test",
      auditorResult: "No exceptions noted.",
      exceptionIds: [],
      excerpt: "Manual excerpt",
      confirmationStatus: "unreviewed",
    });
    const baseMapping = {
      reportPage: 21,
      excerpt: "Mapping excerpt",
      classARuleId: project.requirements[0]!.ruleId,
      coverage: "needs_human_review" as const,
      reason: "Needs review",
      gapDescription: "",
      additionalEvidenceNeeded: "",
      suggested: false,
      confirmed: false,
    };
    project.mappings.push(
      { ...baseMapping, id: "mapping-extracted", soc2ControlId: "EXTRACTED-CC6.1" },
      { ...baseMapping, id: "mapping-existing", soc2ControlId: "EXISTING-CC6.1" },
    );

    updateExtractionCandidateValue(project, candidateId, "EXISTING-CC6.1");
    applyExtractionCandidateDecision(project, candidateId, "edited");
    expect(project.mappings).toHaveLength(1);
    expect(project.mappings[0]).toMatchObject({
      soc2ControlId: "EXISTING-CC6.1",
      confirmed: false,
      reviewOutcome: "needs_expert_review",
      coverage: "needs_human_review",
    });

    applyExtractionCandidateDecision(project, candidateId, "ignored");
    expect(project.soc2.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "EXISTING-CC6.1", title: "Existing manual control" }),
      ]),
    );
  });
});
