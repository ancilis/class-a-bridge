import {
  isProviderApprovedRequirement,
  type BridgeProject,
  type RequirementWork,
} from "@class-a-bridge/project";
import { SCHEMA_MANIFEST, validateOfficialDocument } from "@class-a-bridge/schemas";

import type {
  CertificationPackageOverviewDocument,
  JsonArtifact,
  OfficialDocumentOptions,
  OfficialDocuments,
  OngoingCertificationReportDocument,
  PackageValidationSummary,
  ProviderContact,
  SecurityDecisionRecordDocument,
} from "./types";

const encoder = new TextEncoder();

const status = (requirement: RequirementWork) => {
  if (isProviderApprovedRequirement(requirement)) return "Implemented";
  if (requirement.status === "not_started" || requirement.status === "needs_information") {
    return "Not Implemented";
  }
  return "Partially Implemented";
};

const statements = (...values: readonly string[]) =>
  values.filter((value) => value.trim().length > 0);

const acronymFrom = (value: string) => {
  const words = value.match(/[\p{L}\p{N}]+/gu) ?? [];
  return (
    words
      .slice(0, 8)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "CSO"
  );
};

function createCertificationPackageOverview(
  project: BridgeProject,
  options: NonNullable<OfficialDocumentOptions["certificationPackageOverview"]>,
): CertificationPackageOverviewDocument {
  const acronym = project.offering.acronym || acronymFrom(project.offering.name);
  const website = options.website ?? project.offering.website ?? project.organization.website;
  const deploymentModel =
    options.deploymentModel ??
    (
      [
        "Public Cloud",
        "Government-Only Cloud",
        "Hybrid Cloud",
        "Community Cloud",
        "Government Community Cloud",
      ] as const
    ).find((model) => model === project.offering.deploymentModel);
  const contacts: ProviderContact[] = [
    ...(options.securityContact ? [options.securityContact] : []),
    ...(options.salesContact ? [options.salesContact] : []),
    ...(options.additionalContacts ?? []),
  ];
  const trustCenter = project.organization.trustCenterUrl
    ? {
        repositoryType: ["Trust Center"],
        url: project.organization.trustCenterUrl,
        repositoryDescription:
          "Provider repository for sharing current security and certification materials.",
        authenticationRequired: options.trustCenterAuthenticationRequired ?? false,
        ...((options.trustCenterAuthenticationRequired ?? false) &&
        options.trustCenterAccessInstructions
          ? { accessRequestInstructions: options.trustCenterAccessInstructions }
          : {}),
      }
    : undefined;
  return {
    serviceIdentification: {
      providerName: project.organization.name,
      serviceName: project.offering.name,
      serviceAcronym: acronym,
      serviceDescription: project.offering.description,
      certificationType: "20x",
      ...(options.fedRampPackageId
        ? { fedRampPackageId: options.fedRampPackageId }
        : project.organization.name && acronym
          ? { fedRampPackageId: `${project.organization.name}-${acronym}` }
          : {}),
      ...(options.ueiNumber ? { ueiNumber: options.ueiNumber } : {}),
      ...(website ? { website } : {}),
      ...(options.logoUrl ? { logo: options.logoUrl } : {}),
    },
    serviceProperties: {
      serviceType: project.offering.serviceModels,
      ...(deploymentModel ? { deploymentModel } : {}),
      ...(options.businessCategories && options.businessCategories.length > 0
        ? { businessCategory: options.businessCategories }
        : {}),
      ...(trustCenter ? { trustCenter } : {}),
      ...(options.nextOngoingCertificationReportDate
        ? { nextOngoingCertificationReportDate: options.nextOngoingCertificationReportDate }
        : {}),
    },
    contactInformation: contacts,
    ...(options.thirdPartyInformationResources
      ? { thirdPartyInformationResources: options.thirdPartyInformationResources }
      : {}),
  };
}

function evidenceFor(project: BridgeProject, requirement: RequirementWork) {
  return requirement.evidenceIds.flatMap((evidenceId) => {
    const item = project.evidence.find(
      (candidate) => candidate.id === evidenceId && candidate.reviewStatus === "reviewed",
    );
    if (!item) return [];
    const evidenceType = (() => {
      switch (item.kind) {
        case "screenshot":
          return "Screenshot";
        case "policy":
          return "Policy";
        case "report":
        case "csv":
          return "Report";
        case "ticket":
          return "Audit Record";
        default:
          return "Audit Record";
      }
    })();
    return [
      {
        evidenceType,
        evidenceDescription: `Evidence candidate — ${item.title}: ${item.description}`,
        ...(item.externalUrl ? { evidenceLocation: item.externalUrl } : {}),
        lastUpdated: item.collectedAt,
      },
    ];
  });
}

function createSecurityDecisionRecord(
  project: BridgeProject,
  options: NonNullable<OfficialDocumentOptions["securityDecisionRecord"]>,
): SecurityDecisionRecordDocument {
  const regular = project.requirements.filter(
    (requirement) => !requirement.ruleId.startsWith("KSI-"),
  );
  const ksi = project.requirements.filter((requirement) => requirement.ruleId.startsWith("KSI-"));
  return {
    ...(options.certificationPackageOverviewUri
      ? { certificationPackageOverviewUri: options.certificationPackageOverviewUri }
      : {}),
    ...(options.portsAndProtocols ? { portsAndProtocols: options.portsAndProtocols } : {}),
    fedRampRequirements: regular.map((requirement) => ({
      frrID: requirement.ruleId,
      frrImplementationStatus: status(requirement),
      frrImplementation: statements(requirement.implementationNarrative, requirement.userResponse),
      frrValidation: statements(requirement.validationNarrative, requirement.verificationNarrative),
      frrAssessment: statements(
        requirement.independentValidation,
        requirement.independentVerification,
      ),
    })),
    keySecurityIndicators: ksi.map((requirement) => ({
      ksiId: requirement.ruleId,
      ksiImplementationStatus: status(requirement),
      ksiImplementation: statements(requirement.implementationNarrative, requirement.userResponse),
      ksiValidation: statements(requirement.validationNarrative, requirement.verificationNarrative),
      ksiAssessment: statements(
        requirement.independentValidation,
        requirement.independentVerification,
      ),
      ksiTests: statements(requirement.verificationNarrative),
      ksiEvidence: evidenceFor(project, requirement),
    })),
  };
}

function createOngoingCertificationReport(
  options: NonNullable<OfficialDocumentOptions["ongoingCertificationReport"]>,
): OngoingCertificationReportDocument {
  return {
    ...(options.certificationPackageOverviewUri
      ? { certificationPackageOverviewUri: options.certificationPackageOverviewUri }
      : {}),
    ...(options.reportFrom && options.reportTo
      ? { reportPeriod: { from: options.reportFrom, to: options.reportTo } }
      : {}),
    certificationDataChanges: [...(options.certificationDataChanges ?? [])],
    ...(options.planningHorizonThrough
      ? {
          plannedCertificationDataChanges: {
            planningHorizonThrough: options.planningHorizonThrough,
            changes: [...(options.plannedChanges ?? [])],
          },
        }
      : {}),
    acceptedVulnerabilities: options.acceptedVulnerabilitiesSummary ?? "",
    transformativeChanges: [...(options.transformativeChanges ?? [])],
    updatedRecommendations: [...(options.updatedRecommendations ?? [])],
    activeAgencies: [...(options.activeAgencies ?? [])],
    reportableIncidents: {
      incidents: (options.reportableIncidents ?? []).map((incident) => ({
        ...(incident.summary ? { summary: incident.summary } : {}),
        ...(incident.occurredAt ? { occurredAt: incident.occurredAt } : {}),
        ...(incident.resolvedAt ? { resolvedAt: incident.resolvedAt } : {}),
        ...(incident.incidentLessonsLearned
          ? { incidentLessonsLearned: incident.incidentLessonsLearned }
          : {}),
      })),
    },
  };
}

export function createOfficialDocuments(
  project: BridgeProject,
  options: OfficialDocumentOptions = {},
): OfficialDocuments {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const certificationPackageOverview = createCertificationPackageOverview(
    project,
    options.certificationPackageOverview ?? {},
  );
  const securityDecisionRecord = createSecurityDecisionRecord(
    project,
    options.securityDecisionRecord ?? {},
  );
  const ongoingCertificationReport = createOngoingCertificationReport(
    options.ongoingCertificationReport ?? {},
  );
  const selectedSchemaNames = new Set([
    "certification-package-overview",
    "security-decision-record",
    "ongoing-certification-report",
  ]);
  return {
    generatedAt,
    certificationPackageOverview: {
      document: "certification-package-overview",
      fileName: "certification-package-overview.json",
      value: certificationPackageOverview,
      validation: validateOfficialDocument(
        "certification-package-overview",
        certificationPackageOverview,
      ),
      generatedAt,
    },
    securityDecisionRecord: {
      document: "security-decision-record",
      fileName: "security-decision-record.json",
      value: securityDecisionRecord,
      validation: validateOfficialDocument("security-decision-record", securityDecisionRecord),
      generatedAt,
    },
    ongoingCertificationReport: {
      document: "ongoing-certification-report",
      fileName: "ongoing-certification-report.json",
      value: ongoingCertificationReport,
      validation: validateOfficialDocument(
        "ongoing-certification-report",
        ongoingCertificationReport,
      ),
      generatedAt,
    },
    schemaManifest: SCHEMA_MANIFEST.filter((entry) => selectedSchemaNames.has(entry.name)).map(
      (entry) => ({
        name: entry.name,
        schemaVersion: entry.schemaVersion,
        source: entry.url,
        sha256: entry.sha256,
        retrievedAt: entry.retrievedAt,
        localChanges: entry.localChanges,
      }),
    ),
  };
}

export function serializeJsonArtifact(documentName: string, value: unknown): JsonArtifact {
  const text = JSON.stringify(value, null, 2)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  return {
    fileName: `${documentName}.json`,
    mimeType: "application/json",
    text: `${text}\n`,
    bytes: encoder.encode(`${text}\n`),
  };
}

export function summarizeValidation(documents: OfficialDocuments): PackageValidationSummary {
  const results = [
    documents.certificationPackageOverview,
    documents.securityDecisionRecord,
    documents.ongoingCertificationReport,
  ];
  return {
    valid: results.every((artifact) => artifact.validation.valid),
    checkedAt: documents.generatedAt,
    documents: results.map((artifact) => ({
      name: artifact.document,
      valid: artifact.validation.valid,
      issues: artifact.validation.issues,
    })),
    officialValidatorUrl: "https://www.fedramp.gov/schemas/",
  };
}
