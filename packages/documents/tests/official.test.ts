import { describe, expect, it } from "vitest";

import { RULE_SELECTIONS } from "@class-a-bridge/rules";

import { createOfficialDocuments, serializeJsonArtifact } from "../src/index";
import { createDocumentProject, GENERATED_AT, OFFICIAL_OPTIONS } from "./fixture";

const accountManagementKsi = (indicators: readonly { readonly ksiId?: unknown }[]) =>
  indicators.find(({ ksiId }) => ksiId === "KSI-IAM-AAM");

describe("official-schema JSON documents", () => {
  it("creates schema-valid CPO, SDR, and example OCR documents", () => {
    const result = createOfficialDocuments(createDocumentProject(), {
      generatedAt: GENERATED_AT,
      ...OFFICIAL_OPTIONS,
    });

    expect(result.certificationPackageOverview.validation).toEqual({ valid: true, issues: [] });
    expect(result.securityDecisionRecord.validation).toEqual({ valid: true, issues: [] });
    expect(result.ongoingCertificationReport.validation).toEqual({ valid: true, issues: [] });
    expect(result.certificationPackageOverview.value.serviceIdentification.certificationType).toBe(
      "20x",
    );
    expect(result.securityDecisionRecord.value.keySecurityIndicators).toHaveLength(
      RULE_SELECTIONS.mandatory.filter((ruleId) => ruleId.startsWith("KSI-")).length,
    );
    expect(
      accountManagementKsi(result.securityDecisionRecord.value.keySecurityIndicators),
    ).toMatchObject({
      ksiEvidence: [],
    });
    expect(result.certificationPackageOverview.value).not.toHaveProperty(
      "thirdPartyInformationResources",
    );
    expect(result.schemaManifest).toHaveLength(3);
  });

  it("keeps incomplete package drafts and returns friendly editable validation issues", () => {
    const result = createOfficialDocuments(createDocumentProject(), { generatedAt: GENERATED_AT });
    const issues = result.certificationPackageOverview.validation.issues;

    expect(result.certificationPackageOverview.validation.valid).toBe(false);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.route.startsWith("#/package/"))).toBe(true);
    expect(issues.every((issue) => issue.expected.length > 0 && issue.resolution.length > 0)).toBe(
      true,
    );
  });

  it("serializes JSON without executable markup", () => {
    const result = createOfficialDocuments(createDocumentProject(), {
      generatedAt: GENERATED_AT,
      ...OFFICIAL_OPTIONS,
    });
    const serialized = serializeJsonArtifact(
      "security-decision-record",
      result.securityDecisionRecord.value,
    );

    expect(serialized.mimeType).toBe("application/json");
    expect(JSON.parse(serialized.text)).toEqual(result.securityDecisionRecord.value);
    expect(serialized.text).not.toContain("</script>");
  });

  it("does not translate an internal-review draft into an implemented assertion", () => {
    const project = createDocumentProject();
    const requirement = project.requirements.find((item) => item.ruleId === "KSI-IAM-AAM")!;
    requirement.status = "complete_for_internal_review";
    const result = createOfficialDocuments(project, {
      generatedAt: GENERATED_AT,
      ...OFFICIAL_OPTIONS,
    });

    expect(
      accountManagementKsi(result.securityDecisionRecord.value.keySecurityIndicators),
    ).toMatchObject({
      ksiImplementationStatus: "Partially Implemented",
    });
  });

  it("does not translate tampered status-only approval into an implemented assertion", () => {
    const project = createDocumentProject();
    const requirement = project.requirements.find((item) => item.ruleId === "KSI-IAM-AAM")!;
    requirement.status = "approved_by_provider";
    const result = createOfficialDocuments(project, {
      generatedAt: GENERATED_AT,
      ...OFFICIAL_OPTIONS,
    });

    expect(
      accountManagementKsi(result.securityDecisionRecord.value.keySecurityIndicators),
    ).toMatchObject({
      ksiImplementationStatus: "Partially Implemented",
    });
  });

  it("does not translate approval with an empty core response into implemented", () => {
    const project = createDocumentProject();
    const requirement = project.requirements.find((item) => item.ruleId === "KSI-IAM-AAM")!;
    requirement.status = "approved_by_provider";
    requirement.providerApprovedBy = "Provider representative";
    requirement.providerApprovedAt = "2026-07-17T15:00:00.000Z";
    requirement.userResponse = "";
    const result = createOfficialDocuments(project, {
      generatedAt: GENERATED_AT,
      ...OFFICIAL_OPTIONS,
    });

    expect(
      accountManagementKsi(result.securityDecisionRecord.value.keySecurityIndicators),
    ).toMatchObject({
      ksiImplementationStatus: "Partially Implemented",
    });
  });

  it("emits implemented only for a complete provider approval record", () => {
    const project = createDocumentProject();
    const requirement = project.requirements.find((item) => item.ruleId === "KSI-IAM-AAM")!;
    requirement.status = "approved_by_provider";
    requirement.providerApprovedBy = "Provider representative";
    requirement.providerApprovedAt = "2026-07-17T15:00:00.000Z";
    const result = createOfficialDocuments(project, {
      generatedAt: GENERATED_AT,
      ...OFFICIAL_OPTIONS,
    });

    expect(
      accountManagementKsi(result.securityDecisionRecord.value.keySecurityIndicators),
    ).toMatchObject({
      ksiImplementationStatus: "Implemented",
    });
  });
});
