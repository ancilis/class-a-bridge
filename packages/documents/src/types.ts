import type { BridgeProject } from "@class-a-bridge/project";
import type { ValidationIssue, ValidationResult } from "@class-a-bridge/schemas";

export const REPORT_KINDS = [
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
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];
export type SupportingReportKind = "external-materials" | "open-items" | "provider-approval";
export type HumanReportKind = ReportKind | SupportingReportKind;

export interface GenerationOptions {
  readonly generatedAt?: string;
}

export interface HumanReport {
  readonly kind: HumanReportKind;
  readonly title: string;
  readonly fileName: string;
  readonly generatedAt: string;
  readonly mimeType: "text/html;charset=utf-8";
  readonly html: string;
  readonly plainText: string;
  readonly watermark?: string;
  readonly pdfInstructions: string;
}

export type DeploymentModel =
  | "Public Cloud"
  | "Government-Only Cloud"
  | "Hybrid Cloud"
  | "Community Cloud"
  | "Government Community Cloud";

export interface ProviderContact {
  readonly contactType: string;
  readonly contactName?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
}

export interface CertificationPackageOverviewOptions {
  readonly fedRampPackageId?: string;
  readonly ueiNumber?: string;
  readonly website?: string;
  readonly logoUrl?: string;
  readonly deploymentModel?: DeploymentModel;
  readonly businessCategories?: readonly string[];
  readonly securityContact?: ProviderContact;
  readonly salesContact?: ProviderContact;
  readonly additionalContacts?: readonly ProviderContact[];
  readonly trustCenterAuthenticationRequired?: boolean;
  readonly trustCenterAccessInstructions?: string;
  readonly nextOngoingCertificationReportDate?: string;
  /** Third-party certification treatment is never inferred from the scope inventory. */
  readonly thirdPartyInformationResources?: {
    readonly certified?: readonly {
      readonly fedRampCertifiedThirdPartyInformationResource: string;
      readonly useCase: string;
    }[];
    readonly nonCertified?: readonly {
      readonly name: string;
      readonly provider: string;
      readonly website?: string;
      readonly useCase: string;
    }[];
  };
}

export interface SecurityDecisionRecordOptions {
  readonly certificationPackageOverviewUri?: string;
  readonly portsAndProtocols?: readonly {
    readonly serviceName?: string;
    readonly portNumber?: string;
    readonly transportProtocol?: string;
    readonly encryption?: string;
    readonly purpose?: string;
  }[];
}

export interface ReportableIncidentSummary {
  readonly summary?: string;
  readonly occurredAt?: string;
  readonly resolvedAt?: string;
  readonly incidentLessonsLearned?: readonly string[];
}

export interface OngoingCertificationReportOptions {
  readonly certificationPackageOverviewUri?: string;
  readonly reportFrom?: string;
  readonly reportTo?: string;
  readonly planningHorizonThrough?: string;
  readonly certificationDataChanges?: readonly string[];
  readonly plannedChanges?: readonly string[];
  readonly acceptedVulnerabilitiesSummary?: string;
  readonly transformativeChanges?: readonly string[];
  readonly updatedRecommendations?: readonly string[];
  readonly activeAgencies?: readonly string[];
  readonly reportableIncidents?: readonly ReportableIncidentSummary[];
}

export interface OfficialDocumentOptions extends GenerationOptions {
  readonly certificationPackageOverview?: CertificationPackageOverviewOptions;
  readonly securityDecisionRecord?: SecurityDecisionRecordOptions;
  readonly ongoingCertificationReport?: OngoingCertificationReportOptions;
}

export interface OfficialArtifact<T extends Record<string, unknown>> {
  readonly document: string;
  readonly fileName: string;
  readonly value: T;
  readonly validation: ValidationResult;
  readonly generatedAt: string;
}

export interface CertificationPackageOverviewDocument extends Record<string, unknown> {
  readonly serviceIdentification: Record<string, unknown>;
  readonly serviceProperties: Record<string, unknown>;
  readonly contactInformation: readonly ProviderContact[];
}

export interface SecurityDecisionRecordDocument extends Record<string, unknown> {
  readonly fedRampRequirements: readonly Record<string, unknown>[];
  readonly keySecurityIndicators: readonly Record<string, unknown>[];
}

export interface OngoingCertificationReportDocument extends Record<string, unknown> {
  readonly certificationDataChanges: readonly string[];
  readonly transformativeChanges: readonly string[];
  readonly updatedRecommendations: readonly string[];
  readonly activeAgencies: readonly string[];
  readonly reportableIncidents: Record<string, unknown>;
}

export interface OfficialDocuments {
  readonly generatedAt: string;
  readonly certificationPackageOverview: OfficialArtifact<CertificationPackageOverviewDocument>;
  readonly securityDecisionRecord: OfficialArtifact<SecurityDecisionRecordDocument>;
  readonly ongoingCertificationReport: OfficialArtifact<OngoingCertificationReportDocument>;
  readonly schemaManifest: readonly {
    readonly name: string;
    readonly schemaVersion: string;
    readonly source: string;
    readonly sha256: string;
    readonly retrievedAt: string;
    readonly localChanges: "none";
  }[];
}

export interface JsonArtifact {
  readonly fileName: string;
  readonly mimeType: "application/json";
  readonly text: string;
  readonly bytes: Uint8Array;
}

export type CsvKind = "action-plan" | "evidence-manifest" | "requirements" | "soc2-mapping";

export interface CsvArtifact {
  readonly kind: CsvKind;
  readonly fileName: string;
  readonly mimeType: "text/csv;charset=utf-8";
  readonly text: string;
  readonly bytes: Uint8Array;
}

export interface DocxArtifact {
  readonly fileName: string;
  readonly mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  readonly bytes: Uint8Array;
}

export interface SelectedAttachment {
  readonly attachmentId: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly userApproved: boolean;
}

export interface PackageFileManifest {
  readonly path: string;
  readonly mediaType: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly category: "human-readable" | "official-json" | "machine-readable" | "attachment";
  readonly containsUserProjectData: boolean;
}

export interface PreparationPackageManifest {
  readonly format: "class-a-bridge-preparation-package";
  readonly formatVersion: 1;
  readonly packageVersion: string;
  readonly createdAt: string;
  readonly project: {
    readonly id: string;
    readonly name: string;
    readonly organization: string;
    readonly offering: string;
    readonly schemaVersion: number;
    readonly ruleCatalogVersion: string;
  };
  readonly regulatorySources: {
    readonly ruleCatalog: Record<string, string>;
    readonly schemas: OfficialDocuments["schemaManifest"];
  };
  readonly files: readonly PackageFileManifest[];
  readonly exclusions: readonly string[];
  readonly attachmentConsent: readonly {
    readonly attachmentId: string;
    readonly archivePath: string;
    readonly userApproved: true;
  }[];
  readonly disclaimer: string;
}

export interface PackageValidationSummary {
  readonly valid: boolean;
  readonly checkedAt: string;
  readonly documents: readonly {
    readonly name: string;
    readonly valid: boolean;
    readonly issues: readonly ValidationIssue[];
  }[];
  readonly officialValidatorUrl: string;
}

export type FinalReviewCheckStatus = "pass" | "warning" | "fail";
export type PackageFreshness = "fresh" | "aging" | "stale" | "needs_confirmation";

export interface FinalReviewCheck {
  readonly id: string;
  readonly label: string;
  readonly status: FinalReviewCheckStatus;
  readonly detail: string;
  readonly route: string;
  readonly resolution: string;
}

export interface FinalReviewChecklist {
  readonly generatedAt: string;
  readonly packageFreshness: PackageFreshness;
  readonly checks: readonly FinalReviewCheck[];
  readonly unresolvedPlaceholders: readonly string[];
  readonly missingReferences: readonly string[];
  readonly missingApprovals: readonly string[];
  readonly providerSubmissionReminder: string;
  readonly disclaimer: string;
}

export interface PreparationPackageOptions extends GenerationOptions {
  readonly packageVersion?: string;
  readonly officialDocuments?: Omit<OfficialDocumentOptions, "generatedAt">;
  readonly selectedAttachments?: readonly SelectedAttachment[];
}

export interface PreparationPackage {
  readonly fileName: string;
  readonly mimeType: "application/zip";
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly manifest: PreparationPackageManifest;
  readonly validation: PackageValidationSummary;
}

export interface AdvisorHandoffModel {
  readonly format: "class-a-bridge-advisor-handoff";
  readonly formatVersion: 1;
  readonly generatedAt: string;
  readonly project: {
    readonly name: string;
    readonly organization: string;
    readonly offering: string;
    readonly serviceModels: readonly string[];
    readonly ruleCatalogVersion: string;
  };
  readonly preliminaryResult?: {
    readonly classification: string;
    readonly label: string;
    readonly summary: string;
    readonly blockers: readonly string[];
    readonly missingInformation: readonly string[];
    readonly recommendedActions: readonly string[];
  };
  readonly scope: {
    readonly summary: string;
    readonly includedResourceCount: number;
    readonly thirdPartyCount: number;
    readonly unresolvedQuestions: readonly string[];
    readonly mismatchFindings: readonly string[];
  };
  readonly materials: readonly {
    readonly kind: string;
    readonly status: string;
  }[];
  readonly requirements: readonly {
    readonly ruleId: string;
    readonly status: string;
    readonly reviewStatus: string;
    readonly owner: string;
    readonly openQuestionCount: number;
  }[];
  readonly evidenceSummary: {
    readonly totalCandidates: number;
    readonly needsReview: number;
    readonly staleOrDueForReview: number;
  };
  readonly actions: readonly {
    readonly title: string;
    readonly category: string;
    readonly priority: string;
    readonly status: string;
    readonly owner: string;
  }[];
  readonly advisorReviewFlags: readonly string[];
  readonly disclaimer: string;
}

export interface AdvisorHandoff {
  readonly model: AdvisorHandoffModel;
  readonly report: HumanReport;
  readonly json: JsonArtifact;
  readonly exclusions: readonly string[];
}

export interface AdvisorHandoffOptions extends GenerationOptions {
  readonly selectedAttachments?: readonly SelectedAttachment[];
}

export interface AdvisorHandoffPackage extends PreparationPackage {
  readonly handoff: AdvisorHandoff;
}

export type ProjectInput = BridgeProject;
