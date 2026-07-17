import type { ErrorObject } from "ajv";

import * as standalone from "./generated/validators.mjs";
import type { OfficialDocumentName } from "./manifest";

export { SCHEMA_MANIFEST } from "./manifest";
export type { OfficialDocumentName, SchemaManifestEntry } from "./manifest";

type StandaloneValidator = ((value: unknown) => boolean) & {
  errors?: ErrorObject[] | null;
};

const validators: Record<OfficialDocumentName, StandaloneValidator> = {
  "accepted-vulnerability-info": standalone.acceptedVulnerabilityInfo,
  "advisor-information": standalone.advisorInformation,
  "assessor-information": standalone.assessorInformation,
  "certification-package-overview": standalone.certificationPackageOverview,
  "common-definitions": standalone.commonDefinitions,
  "historical-ver-activity": standalone.historicalVerActivity,
  "incident-report": standalone.incidentReport,
  "ongoing-certification-report": standalone.ongoingCertificationReport,
  "security-decision-record": standalone.securityDecisionRecord,
  "significant-change-notifications": standalone.significantChangeNotifications,
  "vulnerability-detail-report": standalone.vulnerabilityDetailReport,
};

export interface ValidationIssue {
  readonly document: OfficialDocumentName;
  readonly pointer: string;
  readonly route: string;
  readonly expected: string;
  readonly current: unknown;
  readonly resolution: string;
  readonly keyword: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

const decodePointer = (part: string) => part.replaceAll("~1", "/").replaceAll("~0", "~");

function valueAtPointer(value: unknown, pointer: string): unknown {
  if (!pointer) return value;
  return pointer
    .split("/")
    .slice(1)
    .map(decodePointer)
    .reduce<unknown>((current, part) => {
      if (Array.isArray(current)) return current[Number(part)];
      if (typeof current === "object" && current !== null) {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, value);
}

function expectedFrom(error: ErrorObject): string {
  if (error.keyword === "required") {
    return `Provide required field “${String(error.params.missingProperty)}”.`;
  }
  if (error.keyword === "enum")
    return `Choose one of ${JSON.stringify(error.params.allowedValues)}.`;
  if (error.keyword === "format")
    return `Provide a value in ${String(error.params.format)} format.`;
  if (error.keyword === "type") return `Provide a ${String(error.params.type)} value.`;
  if (error.keyword === "pattern")
    return `Match the required pattern ${String(error.params.pattern)}.`;
  return error.message ? `Value ${error.message}.` : `Satisfy the ${error.keyword} constraint.`;
}

export function validateOfficialDocument(
  document: OfficialDocumentName,
  value: unknown,
): ValidationResult {
  const validator = validators[document];
  const valid = validator(value);
  if (valid) return { valid: true, issues: [] };

  const issues = (validator.errors ?? []).map((error): ValidationIssue => {
    const missing = error.keyword === "required" ? `/${String(error.params.missingProperty)}` : "";
    const pointer = `${error.instancePath}${missing}`;
    return {
      document,
      pointer,
      route: `#/package/${document}${pointer}`,
      expected: expectedFrom(error),
      current: valueAtPointer(value, pointer),
      resolution:
        error.keyword === "enum"
          ? "Choose an allowed value, then generate and validate the package again."
          : "Add or correct this field, then generate and validate the package again.",
      keyword: error.keyword,
    };
  });
  return { valid: false, issues };
}
