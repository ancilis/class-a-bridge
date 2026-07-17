import type { ErrorObject } from "ajv";

export interface StandaloneValidator {
  (value: unknown): boolean;
  errors?: ErrorObject[] | null;
}

export const acceptedVulnerabilityInfo: StandaloneValidator;
export const advisorInformation: StandaloneValidator;
export const assessorInformation: StandaloneValidator;
export const certificationPackageOverview: StandaloneValidator;
export const commonDefinitions: StandaloneValidator;
export const historicalVerActivity: StandaloneValidator;
export const incidentReport: StandaloneValidator;
export const ongoingCertificationReport: StandaloneValidator;
export const securityDecisionRecord: StandaloneValidator;
export const significantChangeNotifications: StandaloneValidator;
export const vulnerabilityDetailReport: StandaloneValidator;
