import { describe, expect, it } from "vitest";

import { generateHumanReport, REPORT_KINDS } from "../src/index";
import { createDocumentProject, GENERATED_AT } from "./fixture";

describe("human-readable reports", () => {
  it("escapes project content and emits a standalone print-safe document", () => {
    const project = createDocumentProject();
    const report = generateHumanReport(project, "soc2-mapping", { generatedAt: GENERATED_AT });

    expect(report.html).toContain("Content-Security-Policy");
    expect(report.html).toContain("@media print");
    expect(report.html).toContain("@page");
    expect(report.html).toContain("Private mapping excerpt &lt;script&gt;");
    expect(report.html).not.toContain("<script>alert('mapping')</script>");
    expect(report.html).toContain("not a FedRAMP determination");
    expect(report.pdfInstructions).toContain("Save as PDF");
  });

  it("watermarks every report generated from a fictional sample", () => {
    const project = createDocumentProject({ sample: true });

    for (const kind of REPORT_KINDS) {
      const report = generateHumanReport(project, kind, { generatedAt: GENERATED_AT });
      expect(report.html).toContain("Fictional example — not for submission.");
      expect(report.watermark).toBe("Fictional example — not for submission.");
    }
  });

  it("covers the release report set with meaningful filenames", () => {
    const project = createDocumentProject();

    expect(REPORT_KINDS).toEqual([
      "preliminary-fit",
      "executive-readiness",
      "detailed-gap",
      "soc2-mapping",
      "scope-summary",
      "mandatory-requirements",
      "evidence-manifest",
      "action-plan",
      "package-validation",
      "advisor-handoff",
    ]);
    for (const kind of REPORT_KINDS) {
      const report = generateHumanReport(project, kind, { generatedAt: GENERATED_AT });
      expect(report.fileName).toMatch(/\.html$/u);
      expect(report.html).toContain("Class A Bridge by Ancilis");
      expect(report.html).toContain(project.organization.name);
      expect(report.html).not.toContain("FedRAMP compliant");
    }
  });

  it("generates a SOC 2 reuse report with inventory, provenance, limitations, and unresolved gaps", () => {
    const report = generateHumanReport(createDocumentProject(), "soc2-mapping", {
      generatedAt: GENERATED_AT,
    });

    expect(report.title).toBe("SOC 2 Reuse and Gap Report");
    expect(report.html).toContain("Report and system metadata");
    expect(report.html).toContain("Confirmed supporting material");
    expect(report.html).toContain("Requirements without confirmed support");
    expect(report.html).toContain("Mapping provenance");
    expect(report.html).toContain("does not automatically satisfy");
  });

  it("exports only reviewed mapping decisions and does not treat rejection as support", () => {
    const project = createDocumentProject();
    project.mappings[0]!.reviewOutcome = "partial_support";
    project.mappings.push(
      {
        ...project.mappings[0]!,
        id: "map-rejected",
        classARuleId: "KSI-IAM-APM",
        excerpt: "Reviewed rejected mapping excerpt.",
        coverage: "no_relevant_mapping",
        reason: "The tested control does not address passwordless authentication.",
        reviewOutcome: "rejected_mapping",
      },
      {
        ...project.mappings[0]!,
        id: "map-unreviewed",
        classARuleId: "FRC-CSO-PKG",
        excerpt: "UNREVIEWED-PRIVATE-SOURCE-EXCERPT",
        confirmed: false,
        reviewOutcome: "needs_expert_review",
        reviewer: undefined,
        reviewDate: undefined,
      },
    );

    const report = generateHumanReport(project, "soc2-mapping", { generatedAt: GENERATED_AT });

    expect(report.html).toContain("Reviewed rejected mapping excerpt.");
    expect(report.html).not.toContain("UNREVIEWED-PRIVATE-SOURCE-EXCERPT");
    expect(report.html).toMatch(/Requirements without confirmed support[\s\S]*KSI-IAM-APM/iu);
  });

  it("lists unresolved external assessment materials in the preliminary result", () => {
    const report = generateHumanReport(createDocumentProject(), "preliminary-fit", {
      generatedAt: GENERATED_AT,
    });

    expect(report.html).toContain("Missing external assessment materials");
    expect(report.html).toContain("Bridge letter");
    expect(report.html).toContain("Missing");
  });

  it("uses the advisor allowlist for the standalone advisor report", () => {
    const project = createDocumentProject();
    project.actions[0]!.sourceRefs = ["PRIVATE-SOURCE-REFERENCE"];
    project.actions[0]!.nextRoute = "#/private/internal-route";
    const report = generateHumanReport(project, "advisor-handoff", {
      generatedAt: GENERATED_AT,
    });

    expect(report.html).toContain(
      "=HYPERLINK(&quot;https://attacker.invalid&quot;,&quot;Review&quot;)",
    );
    expect(report.html).not.toContain("Collect the account lifecycle configuration.");
    expect(report.html).not.toContain("PRIVATE-SOURCE-REFERENCE");
    expect(report.html).not.toContain("#/private/internal-route");
  });

  it("shows every mandatory catalog rule when its seeded record has not been started", () => {
    const report = generateHumanReport(createDocumentProject(), "mandatory-requirements", {
      generatedAt: GENERATED_AT,
    });

    expect(report.html).toContain("KSI-CMT-LMC");
    expect(report.html).toContain("Not started");
    expect(report.html).toContain("2026.07.14.01");
  });

  it("excludes tampered status-only records from the provider approval report", () => {
    const project = createDocumentProject();
    const requirement = project.requirements.find((item) => item.ruleId === "KSI-IAM-AAM")!;
    requirement.status = "approved_by_provider";

    const report = generateHumanReport(project, "provider-approval", {
      generatedAt: GENERATED_AT,
    });

    expect(report.html).not.toContain("KSI-IAM-AAM");
  });
});
