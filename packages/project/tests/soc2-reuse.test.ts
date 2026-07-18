import { describe, expect, it } from "vitest";

import { createEmptyProject, type BridgeProject } from "../src/model";
import {
  exportSoc2ControlsCsv,
  parseSoc2ControlsCsv,
  removeSoc2Control,
  soc2ControlCsvTemplate,
  suggestSoc2Mappings,
} from "../src/soc2-reuse";

const addControl = (
  project: BridgeProject,
  control: Partial<BridgeProject["soc2"]["controls"][number]> = {},
) => {
  project.soc2.controls.push({
    id: "SOC2-CC8.1",
    title: "Production change management",
    description:
      "Production deployments and emergency changes require review and retain an audit log.",
    trustServicesCriteria: ["CC8.1"],
    reportPages: [70],
    auditorTest: "Inspected a sample of pull requests and production deployments.",
    auditorResult: "No exceptions noted.",
    exceptionIds: [],
    excerpt: "Every sampled production change had an approved record.",
    reportPeriodStart: "2025-07-01",
    reportPeriodEnd: "2026-06-30",
    systemScope: "Northstar Cloud",
    scopeAlignment: "aligned",
    confirmationStatus: "confirmed",
    reviewer: "Test reviewer",
    reviewDate: "2026-07-18",
    ...control,
  });
};

describe("deterministic SOC 2 mapping suggestions", () => {
  it("returns stable, explainable candidates without mutating the project", () => {
    const project = createEmptyProject("Mapping suggestions", "Northstar");
    project.offering.name = "Northstar Cloud";
    project.soc2.systemName = "Northstar Cloud";
    project.soc2.reportStart = "2025-07-01";
    project.soc2.reportEnd = "2026-06-30";
    addControl(project);
    const before = structuredClone(project);

    const first = suggestSoc2Mappings(project);
    const second = suggestSoc2Mappings(project);
    const change = first.find(
      ({ classARuleId, soc2ControlId }) =>
        classARuleId === "KSI-CMT-LMC" && soc2ControlId === "SOC2-CC8.1",
    );

    expect(first).toEqual(second);
    expect(project).toEqual(before);
    expect(change).toEqual(
      expect.objectContaining({
        suggestionLevel: "strong_candidate",
        confirmed: false,
        matchedCriteria: ["CC8.1"],
        scopeAlignment: "aligned",
        periodAlignment: "aligned",
        testResultStatus: "no_exception_reported",
      }),
    );
    expect(change?.reason).toMatch(/CC8\.1|change/iu);
    expect(change?.missingInformation).toEqual(expect.any(Array));
    expect(project.requirements.every(({ status }) => status === "not_started")).toBe(true);
  });

  it("suppresses a single generic keyword without a criterion or supporting pattern", () => {
    const project = createEmptyProject("False positive", "Northstar");
    addControl(project, {
      id: "SOC2-FIN-1",
      title: "Financial account close",
      description: "The finance team reconciles a general-ledger account every quarter.",
      trustServicesCriteria: ["CC1.2"],
      auditorTest: "Inspected a quarterly accounting reconciliation.",
      auditorResult: "No exceptions noted.",
      excerpt: "The account balance was approved.",
    });

    const suggestions = suggestSoc2Mappings(project);
    expect(
      suggestions.some(
        ({ soc2ControlId, classARuleId }) =>
          soc2ControlId === "SOC2-FIN-1" && classARuleId.startsWith("KSI-IAM-"),
      ),
    ).toBe(false);
  });

  it("surfaces scope, period, exception, and missing-test conflicts", () => {
    const project = createEmptyProject("Conflict suggestions", "Northstar");
    project.offering.name = "Federal Metrics";
    project.soc2.systemName = "Commercial Metrics";
    project.soc2.reportStart = "2025-07-01";
    project.soc2.reportEnd = "2026-06-30";
    project.soc2.exceptions.push({
      id: "exception-change",
      title: "Emergency changes",
      description: "One emergency change lacked timely approval.",
      materiality: "not_sure",
      pages: [71],
    });
    addControl(project, {
      systemScope: "Commercial Metrics only",
      scopeAlignment: "potential_mismatch",
      reportPeriodEnd: "2025-06-30",
      auditorResult: "",
      exceptionIds: ["exception-change"],
      exceptionStatus: "exception_reported",
      treatment: "carve_out",
    });

    const change = suggestSoc2Mappings(project).find(
      ({ classARuleId }) => classARuleId === "KSI-CMT-LMC",
    );
    expect(change).toEqual(
      expect.objectContaining({
        suggestionLevel: "expert_review_suggested",
        scopeAlignment: "potential_mismatch",
        periodAlignment: "mismatch",
        testResultStatus: "missing",
        exceptionStatus: "exception_reported",
      }),
    );
    expect(change?.missingInformation.join(" ")).toMatch(/test result/iu);
    expect(change?.conflicts.join(" ")).toMatch(/scope|period|exception|carve/iu);
  });

  it("treats mixed effective-and-deviation wording as a conflict", () => {
    const project = createEmptyProject("Mixed auditor result", "Northstar");
    project.offering.name = "Northstar Cloud";
    project.soc2.reportStart = "2025-07-01";
    project.soc2.reportEnd = "2026-06-30";
    addControl(project, {
      auditorResult: "The control operated effectively, except for one deviation in the sample.",
    });

    const change = suggestSoc2Mappings(project).find(
      ({ classARuleId }) => classARuleId === "KSI-CMT-LMC",
    );

    expect(change).toEqual(
      expect.objectContaining({
        suggestionLevel: "expert_review_suggested",
        testResultStatus: "exception_reported",
      }),
    );
    expect(change?.conflicts.join(" ")).toMatch(/exception|failed/iu);
  });

  it("does not let an initial no-exception phrase hide a later deviation", () => {
    const project = createEmptyProject("Mixed auditor result", "Northstar");
    project.offering.name = "Northstar Cloud";
    project.soc2.reportStart = "2025-07-01";
    project.soc2.reportEnd = "2026-06-30";
    addControl(project, {
      auditorResult: "No exceptions were noted, except for one deviation in the sampled period.",
    });

    const change = suggestSoc2Mappings(project).find(
      ({ classARuleId }) => classARuleId === "KSI-CMT-LMC",
    );

    expect(change).toEqual(
      expect.objectContaining({
        suggestionLevel: "expert_review_suggested",
        testResultStatus: "exception_reported",
      }),
    );
  });

  it("never promotes an unreviewed imported control to a strong candidate", () => {
    const project = createEmptyProject("Unreviewed control", "Northstar");
    project.offering.name = "Northstar Cloud";
    project.soc2.reportStart = "2025-07-01";
    project.soc2.reportEnd = "2026-06-30";
    addControl(project, { confirmationStatus: "unreviewed" });

    const change = suggestSoc2Mappings(project).find(
      ({ classARuleId }) => classARuleId === "KSI-CMT-LMC",
    );

    expect(change?.suggestionLevel).toBe("insufficient_information");
    expect(change?.missingInformation.join(" ")).toMatch(/confirm.*control/iu);
  });

  it("never promotes a control without its auditor test procedure to a strong candidate", () => {
    const project = createEmptyProject("Missing auditor test", "Northstar");
    project.offering.name = "Northstar Cloud";
    project.soc2.reportStart = "2025-07-01";
    project.soc2.reportEnd = "2026-06-30";
    addControl(project, { auditorTest: "" });

    const change = suggestSoc2Mappings(project).find(
      ({ classARuleId }) => classARuleId === "KSI-CMT-LMC",
    );

    expect(change?.suggestionLevel).toBe("insufficient_information");
    expect(change?.missingInformation.join(" ")).toMatch(/auditor test procedure/iu);
  });

  it("does not suggest a pair already represented by the authoritative mapping list", () => {
    const project = createEmptyProject("Existing mapping", "Northstar");
    addControl(project);
    project.mappings.push({
      id: "mapping-existing",
      soc2ControlId: "SOC2-CC8.1",
      reportPage: 70,
      excerpt: "Every sampled production change had an approved record.",
      classARuleId: "KSI-CMT-LMC",
      coverage: "partially_covered",
      reason: "Provider-created mapping.",
      gapDescription: "Confirm complete logging coverage.",
      additionalEvidenceNeeded: "Current configuration export.",
      suggested: false,
      confirmed: false,
    });

    expect(
      suggestSoc2Mappings(project).some(
        ({ classARuleId, soc2ControlId }) =>
          classARuleId === "KSI-CMT-LMC" && soc2ControlId === "SOC2-CC8.1",
      ),
    ).toBe(false);
  });
});

describe("SOC 2 control CSV", () => {
  it("provides a non-JSON template and losslessly parses its supported fields", () => {
    const template = soc2ControlCsvTemplate();
    expect(template).toMatch(/^Control identifier,Control title,/u);

    const csv = [
      template.split("\n")[0],
      [
        "SOC2-CC6.1",
        "Logical access",
        "Access changes are approved and logged.",
        "CC6.1; CC6.2",
        "42-43",
        "Access is approved before provisioning.",
        "Inspected 25 access changes.",
        "No exceptions noted.",
        "no_exception_reported",
        "",
        "not_required",
        "2025-07-01",
        "2026-06-30",
        "Event driven",
        "Identity team",
        "Northstar Cloud",
        "Production",
        "",
        "inclusive",
        "Customers approve their administrators.",
        "",
        "evidence-access-review",
        "confirmed",
        "Taylor Morgan",
        "2026-07-18",
        "Confirmed from page 42.",
      ].join(","),
    ].join("\n");

    const parsed = parseSoc2ControlsCsv(csv, { knownEvidenceIds: ["evidence-access-review"] });
    expect(parsed.issues).toEqual([]);
    expect(parsed.controls).toEqual([
      expect.objectContaining({
        id: "SOC2-CC6.1",
        trustServicesCriteria: ["CC6.1", "CC6.2"],
        reportPages: [42, 43],
        reportPeriodStart: "2025-07-01",
        reportPeriodEnd: "2026-06-30",
        confirmationStatus: "unreviewed",
      }),
    ]);
  });

  it("requires an explicit in-product review even when imported CSV claims confirmation", () => {
    const template = soc2ControlCsvTemplate();
    const cells = Array.from({ length: 26 }, () => "");
    cells[0] = "SOC2-CC6.1";
    cells[1] = "Access review";
    cells[4] = "42";
    cells[22] = "confirmed";
    cells[23] = "Morgan Lee";
    cells[24] = "2026-07-18";

    const parsed = parseSoc2ControlsCsv(`${template.split("\n")[0]}\n${cells.join(",")}`);

    expect(parsed.issues).toEqual([]);
    expect(parsed.controls[0]?.confirmationStatus).toBe("unreviewed");
  });

  it("reports invalid and duplicate rows without importing them", () => {
    const header = soc2ControlCsvTemplate().split("\n")[0];
    const result = parseSoc2ControlsCsv(
      `${header}\nDUP,First,,,,,,,,,,,,,,,,,,,,,,,,\nDUP,Second,,,,,,,,,,,,,,,,,,,,,,,,\n,Missing ID,,,,,,,,,,,,,,,,,,,,,,,,`,
    );

    expect(result.controls).toHaveLength(1);
    expect(result.issues.map(({ message }) => message).join(" ")).toMatch(/duplicate|required/iu);
  });

  it("accepts tab-delimited spreadsheet paste using the same reviewed columns", () => {
    const header = soc2ControlCsvTemplate().split("\n")[0]!.replaceAll(",", "\t");
    const cells = Array.from({ length: 26 }, () => "");
    cells[0] = "SOC2-CC7.3";
    cells[1] = "Incident evaluation";
    cells[2] = "Security events are evaluated for incident handling.";
    cells[3] = "CC7.3";
    cells[4] = "55";
    cells[5] = "Events are triaged by security operations.";
    cells[6] = "Inspected incident triage records.";
    cells[7] = "No exceptions noted.";

    const parsed = parseSoc2ControlsCsv(`${header}\n${cells.join("\t")}`);
    expect(parsed.issues).toEqual([]);
    expect(parsed.controls[0]).toEqual(
      expect.objectContaining({ id: "SOC2-CC7.3", trustServicesCriteria: ["CC7.3"] }),
    );
  });

  it("formula-escapes exported user-controlled cells", () => {
    const project = createEmptyProject("CSV safety", "Provider");
    addControl(project, { title: '=HYPERLINK("https://evil.example")' });
    const csv = exportSoc2ControlsCsv(project.soc2.controls);
    expect(csv).toContain("'=HYPERLINK");
  });

  it("rejects CSV evidence references that do not already exist in the project", () => {
    const template = soc2ControlCsvTemplate();
    const cells = Array.from({ length: 26 }, () => "");
    cells[0] = "SOC2-CC6.9";
    cells[1] = "Access review";
    cells[4] = "42";
    cells[21] = "missing-evidence";

    const parsed = parseSoc2ControlsCsv(`${template.split("\n")[0]}\n${cells.join(",")}`, {
      knownEvidenceIds: [],
    });

    expect(parsed.controls).toEqual([]);
    expect(parsed.issues).toContainEqual(
      expect.objectContaining({ row: 2, column: "Evidence references" }),
    );
  });
});

describe("SOC 2 control removal", () => {
  it("cleans requirement, evidence, and mapping references atomically", () => {
    const project = createEmptyProject("Control removal", "Northstar");
    addControl(project);
    project.requirements[0]!.soc2ControlIds = ["SOC2-CC8.1"];
    project.evidence.push({
      id: "evidence-change",
      title: "Change sample",
      description: "Candidate",
      kind: "report",
      owner: "Engineering",
      collectedAt: "2026-07-18",
      relatedRequirementIds: [],
      relatedSoc2ControlIds: ["SOC2-CC8.1"],
      sha256: "a".repeat(64),
      sensitivity: "confidential",
      notes: "",
      reviewStatus: "candidate",
    });
    project.mappings.push({
      id: "mapping-change",
      soc2ControlId: "SOC2-CC8.1",
      reportPage: 70,
      excerpt: "Change sample",
      classARuleId: "KSI-CMT-LMC",
      coverage: "partially_covered",
      reason: "Possible support",
      gapDescription: "Confirm completeness",
      additionalEvidenceNeeded: "Configuration",
      suggested: true,
      confirmed: false,
    });

    const next = removeSoc2Control(project, "SOC2-CC8.1");

    expect(next.soc2.controls).toEqual([]);
    expect(next.mappings).toEqual([]);
    expect(next.requirements[0]!.soc2ControlIds).toEqual([]);
    expect(next.evidence[0]!.relatedSoc2ControlIds).toEqual([]);
  });
});
