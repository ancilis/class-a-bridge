import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateCsv,
  generateHumanReport,
  generatePreparationPackage,
  type OfficialDocumentOptions,
} from "@class-a-bridge/documents";
import { exportProjectBundle, type BridgeProject } from "@class-a-bridge/project";
import { strToU8, zipSync } from "fflate";

import { ACME_METRICS_PROJECT, SAMPLE_WATERMARK } from "../src/index";

export const GENERATED_SAMPLE_ARTIFACTS = {
  project: "acme-metrics-fictional-sample.classabridge",
  reuseHtml: "acme-metrics-fictional-soc2-reuse-and-gap.html",
  reuseCsv: "acme-metrics-fictional-soc2-reuse-mapping.csv",
  package: "acme-metrics-fictional-class-a-preparation-package.zip",
  licenseBundle: "class-a-bridge-fictional-sample-license-and-notice.zip",
  manifest: "sample-artifacts-manifest.json",
} as const;

const DEFAULT_GENERATED_AT = "2026-07-18T12:00:00.000Z";
const encoder = new TextEncoder();

export interface GenerateReleaseSampleArtifactsOptions {
  readonly outputDirectory?: string;
  readonly repositoryRoot?: string;
  readonly generatedAt?: string;
}

export interface GeneratedReleaseSampleArtifact {
  readonly fileName: string;
  readonly mediaType: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface GeneratedReleaseSampleArtifactsResult {
  readonly outputDirectory: string;
  readonly generatedAt: string;
  readonly artifacts: readonly GeneratedReleaseSampleArtifact[];
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

const officialDocumentOptions = (project: BridgeProject): OfficialDocumentOptions => {
  const certification = project.packageInputs.certificationPackageOverview;
  const decision = project.packageInputs.securityDecisionRecord;
  const ongoing = project.packageInputs.ongoingCertificationReport;
  const contact = (
    contactType: string,
    value: typeof certification.securityContact,
  ): NonNullable<
    NonNullable<OfficialDocumentOptions["certificationPackageOverview"]>["securityContact"]
  > => ({
    contactType,
    ...(value.name ? { contactName: value.name } : {}),
    ...(value.email ? { contactEmail: value.email } : {}),
    ...(value.phone ? { contactPhone: value.phone } : {}),
  });

  return {
    certificationPackageOverview: {
      ...(certification.fedRampPackageId
        ? { fedRampPackageId: certification.fedRampPackageId }
        : {}),
      ...(certification.ueiNumber ? { ueiNumber: certification.ueiNumber } : {}),
      ...(certification.website ? { website: certification.website } : {}),
      ...(certification.logoUrl ? { logoUrl: certification.logoUrl } : {}),
      ...(certification.deploymentModel ? { deploymentModel: certification.deploymentModel } : {}),
      businessCategories: certification.businessCategories,
      securityContact: contact("Security", certification.securityContact),
      salesContact: contact("Sales", certification.salesContact),
      trustCenterAuthenticationRequired: certification.trustCenterAuthenticationRequired,
      ...(certification.trustCenterAccessInstructions
        ? { trustCenterAccessInstructions: certification.trustCenterAccessInstructions }
        : {}),
      ...(certification.nextOngoingCertificationReportDate
        ? { nextOngoingCertificationReportDate: certification.nextOngoingCertificationReportDate }
        : {}),
    },
    securityDecisionRecord: {
      ...(decision.certificationPackageOverviewUri
        ? { certificationPackageOverviewUri: decision.certificationPackageOverviewUri }
        : {}),
      portsAndProtocols: decision.portsAndProtocols.map((entry) => ({
        serviceName: entry.serviceName,
        portNumber: entry.portNumber,
        transportProtocol: entry.transportProtocol,
        encryption: entry.encryption,
        purpose: entry.purpose,
      })),
    },
    ongoingCertificationReport: {
      ...(ongoing.certificationPackageOverviewUri
        ? { certificationPackageOverviewUri: ongoing.certificationPackageOverviewUri }
        : {}),
      ...(ongoing.reportFrom ? { reportFrom: ongoing.reportFrom } : {}),
      ...(ongoing.reportTo ? { reportTo: ongoing.reportTo } : {}),
      ...(ongoing.planningHorizonThrough
        ? { planningHorizonThrough: ongoing.planningHorizonThrough }
        : {}),
      certificationDataChanges: ongoing.certificationDataChanges,
      plannedChanges: ongoing.plannedChanges,
      acceptedVulnerabilitiesSummary: ongoing.acceptedVulnerabilitiesSummary,
      transformativeChanges: ongoing.transformativeChanges,
      updatedRecommendations: ongoing.updatedRecommendations,
      activeAgencies: ongoing.activeAgencies,
    },
  };
};

const sampleCsv = (csv: string, generatedAt: string) => {
  const withoutBom = csv.replace(/^\ufeff/u, "");
  return `\ufeff"${SAMPLE_WATERMARK}"\r\n"Generated ${generatedAt} from the fictional Acme Metrics sample workspace. The mapping header begins on line 4."\r\n\r\n${withoutBom}`;
};

const generatedOutputFiles = (project: BridgeProject) =>
  project.generatedOutputs.flatMap((output) => {
    if (!output.content) return [];
    return [
      {
        id: output.id,
        fileName: `${output.id}.${output.format}`,
        bytes: encoder.encode(output.content),
      },
    ];
  });

export async function generateReleaseSampleArtifacts(
  options: GenerateReleaseSampleArtifactsOptions = {},
): Promise<GeneratedReleaseSampleArtifactsResult> {
  const repositoryRoot = path.resolve(
    options.repositoryRoot ?? path.join(import.meta.dirname, "../../.."),
  );
  const outputDirectory = path.resolve(
    options.outputDirectory ?? path.join(repositoryRoot, "reports/release/artifacts"),
  );
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const project = structuredClone(ACME_METRICS_PROJECT);
  project.metadata.updatedAt = generatedAt;
  project.metadata.lastLocalSaveAt = generatedAt;

  await mkdir(outputDirectory, { recursive: true });

  const projectBundle = await exportProjectBundle(project, {
    generatedOutputs: generatedOutputFiles(project),
  });
  const reuseReport = generateHumanReport(project, "soc2-mapping", { generatedAt });
  const reuseHtml = encoder.encode(reuseReport.html);
  const reuseCsv = encoder.encode(
    sampleCsv(generateCsv(project, "soc2-mapping").text, generatedAt),
  );
  const preparationPackage = await generatePreparationPackage(project, {
    generatedAt,
    packageVersion: "0.9.0-public-beta-fictional-example",
    officialDocuments: officialDocumentOptions(project),
  });
  if (!preparationPackage.validation.valid) {
    const invalidDocuments = preparationPackage.validation.documents
      .filter(({ valid }) => !valid)
      .map(({ name }) => name)
      .join(", ");
    throw new Error(
      `Fictional sample package failed official JSON validation: ${invalidDocuments}`,
    );
  }

  const license = new Uint8Array(await readFile(path.join(repositoryRoot, "LICENSE")));
  const notice = new Uint8Array(await readFile(path.join(repositoryRoot, "NOTICE")));
  const licenseBundle = zipSync(
    {
      "README.txt": strToU8(
        `${SAMPLE_WATERMARK}\n\nThis bundle accompanies the fictional Acme Metrics release artifacts. LICENSE and NOTICE are unmodified repository source files.\n`,
      ),
      LICENSE: license,
      NOTICE: notice,
    },
    { level: 6 },
  );

  const pending = [
    {
      fileName: GENERATED_SAMPLE_ARTIFACTS.project,
      mediaType: "application/vnd.ancilis.class-a-bridge+zip",
      bytes: projectBundle,
      description: "Portable fictional Acme Metrics project backup with generated sample outputs.",
    },
    {
      fileName: GENERATED_SAMPLE_ARTIFACTS.reuseHtml,
      mediaType: reuseReport.mimeType,
      bytes: reuseHtml,
      description: "Print-friendly fictional SOC 2 Reuse and Gap Report.",
    },
    {
      fileName: GENERATED_SAMPLE_ARTIFACTS.reuseCsv,
      mediaType: "text/csv;charset=utf-8",
      bytes: reuseCsv,
      description: "Fictional SOC 2-to-Class A mapping matrix with a visible sample notice.",
    },
    {
      fileName: GENERATED_SAMPLE_ARTIFACTS.package,
      mediaType: preparationPackage.mimeType,
      bytes: preparationPackage.bytes,
      description: "Fictional Class A preparation package scaffold; not a submission package.",
    },
    {
      fileName: GENERATED_SAMPLE_ARTIFACTS.licenseBundle,
      mediaType: "application/zip",
      bytes: licenseBundle,
      description: "Apache-2.0 license and notice bundle accompanying the fictional samples.",
    },
  ] as const;

  const manifestArtifacts = pending.map(({ fileName, mediaType, bytes, description }) => ({
    fileName,
    mediaType,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    sample: true,
    description,
  }));
  await Promise.all(
    pending.map(({ fileName, bytes }) => writeFile(path.join(outputDirectory, fileName), bytes)),
  );

  const manifestBytes = encoder.encode(
    `${JSON.stringify(
      {
        format: "class-a-bridge-fictional-release-artifacts",
        formatVersion: 1,
        generatedAt,
        sourceFixture: "@class-a-bridge/testing ACME_METRICS_PROJECT",
        watermark: SAMPLE_WATERMARK,
        disclaimer:
          "These artifacts are fictional demonstrations. They are not certification materials and must not be submitted.",
        artifacts: manifestArtifacts,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(outputDirectory, GENERATED_SAMPLE_ARTIFACTS.manifest), manifestBytes);

  return {
    outputDirectory,
    generatedAt,
    artifacts: [
      ...manifestArtifacts.map(({ fileName, mediaType, bytes, sha256: hash }) => ({
        fileName,
        mediaType,
        bytes,
        sha256: hash,
      })),
      {
        fileName: GENERATED_SAMPLE_ARTIFACTS.manifest,
        mediaType: "application/json",
        bytes: manifestBytes.byteLength,
        sha256: sha256(manifestBytes),
      },
    ],
  };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  void generateReleaseSampleArtifacts(process.argv[2] ? { outputDirectory: process.argv[2] } : {})
    .then((result) => {
      process.stdout.write(
        `Generated ${result.artifacts.length} fictional release artifacts in ${result.outputDirectory}\n`,
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    });
}
