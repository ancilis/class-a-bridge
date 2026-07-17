import { describe, expect, it } from "vitest";

import { extractSoc2Candidates, validatePdfFile } from "../src/lib/pdf";

describe("local deterministic SOC 2 parsing", () => {
  it("finds candidates with page provenance and does not assert authority", () => {
    const candidates = extractSoc2Candidates([
      "Independent Service Auditor's Report. SOC 2 Type II. Acme Metrics Cloud System. For the period July 1, 2025 to June 30, 2026. Security and Availability criteria.",
      "Subservice organizations are presented using the carve-out method. Exception: one access removal was delayed. Control ACME-CC6.1.",
    ]);
    expect(
      candidates.some(
        (candidate) => candidate.field === "SOC 2 report type" && candidate.page === 1,
      ),
    ).toBe(true);
    expect(
      candidates.some(
        (candidate) => candidate.field === "Carve-out treatment" && candidate.page === 2,
      ),
    ).toBe(true);
    expect(candidates.every((candidate) => candidate.decision === "unreviewed")).toBe(true);
  });

  it("rejects oversized and non-PDF inputs before parsing", () => {
    expect(
      validatePdfFile({ name: "report.exe", size: 100, type: "application/octet-stream" }),
    ).toMatch(/PDF/iu);
    expect(
      validatePdfFile({ name: "report.pdf", size: 26 * 1024 * 1024, type: "application/pdf" }),
    ).toMatch(/25 MB/iu);
  });
});
