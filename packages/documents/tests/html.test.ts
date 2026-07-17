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

  it("shows every mandatory catalog rule even when the project record has not been started", () => {
    const report = generateHumanReport(createDocumentProject(), "mandatory-requirements", {
      generatedAt: GENERATED_AT,
    });

    expect(report.html).toContain("KSI-CMT-LMC");
    expect(report.html).toContain("No project record");
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
