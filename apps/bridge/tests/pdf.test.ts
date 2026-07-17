import { describe, expect, it } from "vitest";

import {
  collectBoundedTextFragments,
  extractSoc2Candidates,
  validatePdfFile,
} from "../src/lib/pdf";

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

  it("attempts every high-value report metadata field with page provenance", () => {
    const candidates = extractSoc2Candidates([
      [
        "Report issuer: Example Assurance LLP.",
        "Report date: July 15, 2026.",
        "SOC 2 Type II for the period July 1, 2025 through June 30, 2026.",
        "Acme Metrics Cloud System.",
        "The subservice organization is presented using the inclusive method.",
        "Complementary user-entity controls are described in Section 4.",
        "A bridge letter may be required after the report period.",
      ].join(" "),
    ]);

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "Report issuer", value: "Example Assurance LLP" }),
        expect.objectContaining({ field: "Report date", value: "2026-07-15" }),
        expect.objectContaining({
          field: "Report period",
          value: "2025-07-01 to 2026-06-30",
        }),
        expect.objectContaining({ field: "Inclusive treatment" }),
        expect.objectContaining({ field: "Complementary user-entity controls" }),
        expect.objectContaining({ field: "Bridge or gap letter reference" }),
      ]),
    );
    expect(candidates.every((candidate) => candidate.page === 1)).toBe(true);
    expect(candidates.every((candidate) => candidate.snippet.length > 0)).toBe(true);
  });

  it("rejects oversized and non-PDF inputs before parsing", () => {
    expect(
      validatePdfFile({ name: "report.exe", size: 100, type: "application/octet-stream" }),
    ).toMatch(/PDF/iu);
    expect(
      validatePdfFile({ name: "report.pdf", size: 26 * 1024 * 1024, type: "application/pdf" }),
    ).toMatch(/25 MB/iu);
  });

  it("bounds decompressed PDF text before joining parser fragments", () => {
    expect(collectBoundedTextFragments(["12345", "67890", "overflow"], 8)).toEqual({
      text: "12345 67",
      truncated: true,
    });
  });
});
