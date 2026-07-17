import { describe, expect, it } from "vitest";

import { createOfficialDocuments, serializeJsonArtifact } from "../src/index";
import { createDocumentProject, GENERATED_AT, OFFICIAL_OPTIONS } from "./fixture";

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
    expect(result.securityDecisionRecord.value.keySecurityIndicators).toHaveLength(1);
    expect(result.securityDecisionRecord.value.keySecurityIndicators[0]).toMatchObject({
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

    expect(result.securityDecisionRecord.value.keySecurityIndicators[0]).toMatchObject({
      ksiImplementationStatus: "Partially Implemented",
    });
  });
});
