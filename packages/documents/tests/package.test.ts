import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../project/src/security";
import {
  createAdvisorHandoff,
  createFinalReviewChecklist,
  createOfficialDocuments,
  generateAdvisorHandoffPackage,
  generatePreparationPackage,
  summarizeValidation,
} from "../src/index";
import { createDocumentProject, GENERATED_AT, OFFICIAL_OPTIONS } from "./fixture";

const decode = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);

describe("preparation package", () => {
  it("generates the numbered package layout, manifest, and checksums", async () => {
    const result = await generatePreparationPackage(createDocumentProject(), {
      generatedAt: GENERATED_AT,
      officialDocuments: OFFICIAL_OPTIONS,
    });
    const files = unzipSync(result.bytes);

    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        "00-read-me/read-me.html",
        "01-certification-package-overview/certification-package-overview.json",
        "02-security-decision-record/security-decision-record.json",
        "03-ongoing-certification-report/ongoing-certification-report.json",
        "04-soc2-bridge/soc2-to-class-a-mapping.html",
        "05-scope/scope-summary.html",
        "06-evidence-manifest/evidence-manifest.csv",
        "07-readiness-and-open-items/action-plan.csv",
        "07-readiness-and-open-items/preliminary-fit-assessment.html",
        "07-readiness-and-open-items/detailed-gap-report.html",
        "07-readiness-and-open-items/mandatory-requirements-report.html",
        "07-readiness-and-open-items/requirements.csv",
        "08-validation/json-validation-report.html",
        "08-validation/final-internal-review-checklist.html",
        "08-validation/final-internal-review-checklist.json",
        "manifest.json",
        "checksums.txt",
      ]),
    );
    expect(result.manifest.files.every((file) => /^[a-f0-9]{64}$/u.test(file.sha256))).toBe(true);
    for (const entry of result.manifest.files) {
      expect(await sha256Hex(files[entry.path]!)).toBe(entry.sha256);
    }
    expect(decode(files["checksums.txt"])).toContain(
      "01-certification-package-overview/certification-package-overview.json",
    );
    expect(result.validation.valid).toBe(true);
  });

  it("creates an actionable final-review checklist without treating schema validity as approval", () => {
    const project = createDocumentProject();
    project.requirements[0]!.implementationNarrative = "TBD after engineering review";
    const official = createOfficialDocuments(project, {
      generatedAt: GENERATED_AT,
      ...OFFICIAL_OPTIONS,
    });
    const checklist = createFinalReviewChecklist(
      project,
      summarizeValidation(official),
      GENERATED_AT,
    );

    expect(checklist.packageFreshness).toBe("needs_confirmation");
    expect(checklist.checks.find((check) => check.id === "json-schema")?.status).toBe("pass");
    expect(checklist.checks.find((check) => check.id === "mandatory-records")?.status).toBe("fail");
    expect(checklist.unresolvedPlaceholders).toContain("requirements.KSI-IAM-AAM.implementation");
    expect(checklist.missingApprovals.length).toBeGreaterThan(0);
    expect(checklist.providerSubmissionReminder).toContain("provider must submit");
  });

  it("recalculates SOC 2 freshness from report dates instead of trusting a historical answer", () => {
    const project = createDocumentProject();
    project.eligibility.answers.push({
      questionId: "soc2_fresh",
      value: "yes",
      answeredAt: "2025-01-01T00:00:00.000Z",
    });
    project.soc2.reportDate = "2025-07-01";
    const official = createOfficialDocuments(project, {
      generatedAt: GENERATED_AT,
      ...OFFICIAL_OPTIONS,
    });

    expect(
      createFinalReviewChecklist(project, summarizeValidation(official), GENERATED_AT)
        .packageFreshness,
    ).toBe("stale");
  });

  it("flags a report approaching the 12-month boundary as aging", () => {
    const project = createDocumentProject();
    project.eligibility.answers.push({
      questionId: "soc2_fresh",
      value: "yes",
      answeredAt: "2026-01-01T00:00:00.000Z",
    });
    project.soc2.reportDate = "2025-08-01";
    const official = createOfficialDocuments(project, {
      generatedAt: GENERATED_AT,
      ...OFFICIAL_OPTIONS,
    });

    expect(
      createFinalReviewChecklist(project, summarizeValidation(official), GENERATED_AT)
        .packageFreshness,
    ).toBe("aging");
  });

  it("flags broken scope, mapping, and evidence relationship references", () => {
    const project = createDocumentProject();
    project.scope.relationships[0]!.toId = "missing-resource";
    project.mappings[0]!.classARuleId = "NOT-A-RULE";
    project.evidence[0]!.relatedRequirementIds = ["MISSING-REQUIREMENT"];
    const official = createOfficialDocuments(project, {
      generatedAt: GENERATED_AT,
      ...OFFICIAL_OPTIONS,
    });
    const checklist = createFinalReviewChecklist(
      project,
      summarizeValidation(official),
      GENERATED_AT,
    );

    expect(checklist.missingReferences).toEqual(
      expect.arrayContaining([
        expect.stringContaining("missing-resource"),
        expect.stringContaining("NOT-A-RULE"),
        expect.stringContaining("MISSING-REQUIREMENT"),
      ]),
    );
  });

  it("excludes source reports and evidence bytes unless a user explicitly approves selection", async () => {
    const project = createDocumentProject();
    const withoutAttachments = await generatePreparationPackage(project, {
      generatedAt: GENERATED_AT,
      officialDocuments: OFFICIAL_OPTIONS,
    });
    const baseFiles = unzipSync(withoutAttachments.bytes);
    const baseText = Object.values(baseFiles).map(decode).join("\n");

    expect(Object.keys(baseFiles).some((path) => path.includes("attachments/"))).toBe(false);
    expect(baseText).not.toContain("confidential-soc2.pdf");
    expect(withoutAttachments.manifest.exclusions).toContain("Original SOC 2 report");

    const attachmentBytes = new TextEncoder().encode("user-approved-evidence-content");
    const withAttachment = await generatePreparationPackage(project, {
      generatedAt: GENERATED_AT,
      officialDocuments: OFFICIAL_OPTIONS,
      selectedAttachments: [
        {
          attachmentId: "att-evidence",
          fileName: "account lifecycle.csv",
          bytes: attachmentBytes,
          userApproved: true,
        },
      ],
    });
    const selectedFiles = unzipSync(withAttachment.bytes);
    const selectedPath = Object.keys(selectedFiles).find((path) => path.includes("attachments/"));
    expect(selectedPath).toBeDefined();
    expect(decode(selectedFiles[selectedPath!])).toBe("user-approved-evidence-content");
  });

  it("rejects attachment bytes that lack explicit user approval", async () => {
    await expect(
      generatePreparationPackage(createDocumentProject(), {
        generatedAt: GENERATED_AT,
        officialDocuments: OFFICIAL_OPTIONS,
        selectedAttachments: [
          {
            attachmentId: "att-evidence",
            fileName: "evidence.txt",
            bytes: new Uint8Array([1]),
            userApproved: false,
          },
        ],
      }),
    ).rejects.toThrow(/explicit user approval/iu);
  });
});

describe("advisor handoff", () => {
  it("uses an allowlisted summary and excludes sensitive project content", () => {
    const project = createDocumentProject();
    const handoff = createAdvisorHandoff(project, { generatedAt: GENERATED_AT });
    const serialized = JSON.stringify(handoff.model);

    expect(serialized).toContain("Acme Metrics");
    expect(serialized).toContain("Scope treatment for the support tool");
    expect(serialized).not.toContain("Private board note");
    expect(serialized).not.toContain("Confidential SOC excerpt");
    expect(serialized).not.toContain("confidential-soc2.pdf");
    expect(serialized).not.toContain("att-evidence");
    expect(handoff.exclusions).toContain("Evidence attachments");
  });

  it("generates a self-contained redacted handoff bundle", async () => {
    const handoff = await generateAdvisorHandoffPackage(createDocumentProject(), {
      generatedAt: GENERATED_AT,
    });
    const files = unzipSync(handoff.bytes);

    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(["advisor-handoff.html", "advisor-handoff.json", "manifest.json"]),
    );
    expect(Object.keys(files).some((path) => path.includes("attachments/"))).toBe(false);
    expect(Object.values(files).map(decode).join("\n")).not.toContain("Private board note");
  });

  it("continues to exclude the source report when only an evidence attachment is selected", async () => {
    const handoff = await generateAdvisorHandoffPackage(createDocumentProject(), {
      generatedAt: GENERATED_AT,
      selectedAttachments: [
        {
          attachmentId: "att-evidence",
          fileName: "approved.txt",
          bytes: new TextEncoder().encode("approved"),
          userApproved: true,
        },
      ],
    });

    expect(handoff.manifest.exclusions).toContain("Original SOC 2 report");
  });
});
