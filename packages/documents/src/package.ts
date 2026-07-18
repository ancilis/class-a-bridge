import { isReviewedSoc2Mapping, safeFilename, sha256Hex } from "@class-a-bridge/project";
import type { BridgeProject } from "@class-a-bridge/project";
import { CATALOG_MANIFEST } from "@class-a-bridge/rules";
import { zipSync } from "fflate";

import { createAdvisorHandoff } from "./advisor";
import {
  callout,
  list,
  PREPARATION_DISCLAIMER,
  renderStandaloneHtml,
  section,
  table,
  text,
} from "./html";
import { createOfficialDocuments, serializeJsonArtifact, summarizeValidation } from "./official";
import { generateHumanReport } from "./reports";
import { createFinalReviewChecklist, renderFinalReviewChecklist } from "./review";
import { generateCsv } from "./tabular";
import type {
  OfficialArtifact,
  OfficialDocumentOptions,
  PackageFileManifest,
  PreparationPackage,
  PreparationPackageManifest,
  PreparationPackageOptions,
  SelectedAttachment,
} from "./types";

const encoder = new TextEncoder();
const MAX_SINGLE_FILE = 25 * 1024 * 1024;
const MAX_PACKAGE_FILES = 200;
const MAX_EXPANDED_BYTES = 100 * 1024 * 1024;

interface PendingFile {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly category: PackageFileManifest["category"];
  readonly containsUserProjectData: boolean;
}

const htmlBytes = (html: string) => encoder.encode(html);

function officialHtml(
  project: BridgeProject,
  title: string,
  artifact: OfficialArtifact<Record<string, unknown>>,
) {
  const body = [
    callout(
      "This is a provider-editable preparation draft. Schema validity is structural and does not mean the content is accurate, complete, approved, or accepted.",
      "warning",
    ),
    section("Document data", `<pre>${text(JSON.stringify(artifact.value, null, 2))}</pre>`),
    section(
      "Schema validation",
      artifact.validation.valid
        ? "<p><strong>Structurally valid against the pinned schema.</strong></p>"
        : table(
            ["Affected field", "Expected", "Current", "How to resolve", "Edit route"],
            artifact.validation.issues.map((issue) => [
              issue.pointer,
              issue.expected,
              JSON.stringify(issue.current),
              issue.resolution,
              issue.route,
            ]),
          ),
    ),
  ].join("");
  return renderStandaloneHtml({
    title,
    organization: project.organization.name,
    offering: project.offering.name,
    generatedAt: artifact.generatedAt,
    body,
    ...(project.metadata.watermark ? { watermark: project.metadata.watermark } : {}),
  });
}

function validationHtml(
  project: BridgeProject,
  validation: ReturnType<typeof summarizeValidation>,
) {
  const allIssues = validation.documents.flatMap((document) =>
    document.issues.map((issue) => ({ document: document.name, issue })),
  );
  const body = [
    callout(
      validation.valid
        ? "All generated JSON documents are structurally valid against the pinned official schemas. Provider and human review remain required."
        : "One or more generated JSON documents contain structural errors. Follow each edit route, correct the source field, and validate again.",
      validation.valid ? "default" : "danger",
    ),
    section(
      "Document results",
      table(
        ["Document", "Result", "Issue count"],
        validation.documents.map((document) => [
          document.name,
          document.valid ? "Structurally valid" : "Invalid",
          document.issues.length,
        ]),
      ),
    ),
    section(
      "Issues",
      table(
        [
          "Document",
          "Affected section",
          "Expected value",
          "Current value",
          "Resolution",
          "Edit route",
        ],
        allIssues.map(({ document, issue }) => [
          document,
          issue.pointer,
          issue.expected,
          JSON.stringify(issue.current),
          issue.resolution,
          issue.route,
        ]),
      ),
    ),
    section(
      "Official browser validator",
      `<p>For an additional check, use FedRAMP’s current schema resources and validator guidance at ${text(validation.officialValidatorUrl)}.</p>`,
    ),
  ].join("");
  return renderStandaloneHtml({
    title: "JSON package validation report",
    organization: project.organization.name,
    offering: project.offering.name,
    generatedAt: validation.checkedAt,
    body,
    ...(project.metadata.watermark ? { watermark: project.metadata.watermark } : {}),
  });
}

function readMeHtml(project: BridgeProject, generatedAt: string) {
  const body = [
    callout(
      "Application preparation complete means only that this scaffold was generated. It does not mean the provider is certified, approved, guaranteed eligible, or ready to submit.",
      "warning",
    ),
    section(
      "How to use this package",
      list([
        "Review every provider representation and unresolved item.",
        "Resolve JSON validation issues and re-run generation.",
        "Confirm current rule and schema versions before application.",
        "Add only attachments the provider has approved for the intended recipient.",
        "The provider must submit its own application; Class A Bridge does not submit it.",
      ]),
    ),
    section(
      "Privacy boundary",
      "<p>The original SOC 2 report and evidence attachments are excluded by default. The manifest records any attachment included through explicit user selection.</p>",
    ),
  ].join("");
  return renderStandaloneHtml({
    title: "Class A preparation package — read me",
    organization: project.organization.name,
    offering: project.offering.name,
    generatedAt,
    body,
    ...(project.metadata.watermark ? { watermark: project.metadata.watermark } : {}),
  });
}

function packageIndexHtml(project: BridgeProject, generatedAt: string, paths: readonly string[]) {
  return renderStandaloneHtml({
    title: "Package index",
    organization: project.organization.name,
    offering: project.offering.name,
    generatedAt,
    body: section(
      "Generated files",
      table(
        ["Path", "Purpose"],
        paths.map((path) => [path, path.split("/").at(-1)?.replaceAll("-", " ") ?? path]),
      ),
    ),
    ...(project.metadata.watermark ? { watermark: project.metadata.watermark } : {}),
  });
}

function projectDisclaimerHtml(project: BridgeProject, generatedAt: string) {
  return renderStandaloneHtml({
    title: "Project disclaimer",
    organization: project.organization.name,
    offering: project.offering.name,
    generatedAt,
    body: [
      callout("This package is not a FedRAMP determination or government submission.", "warning"),
      section("Provider responsibilities", `<p>${text(PREPARATION_DISCLAIMER)}</p>`),
    ].join(""),
    ...(project.metadata.watermark ? { watermark: project.metadata.watermark } : {}),
  });
}

function validAttachmentIds(project: BridgeProject) {
  return new Set(
    [
      project.soc2.sourceReport?.attachmentId,
      ...project.evidence.map((item) => item.attachmentId),
    ].filter((value): value is string => Boolean(value)),
  );
}

function uniqueAttachmentPath(
  project: BridgeProject,
  attachment: SelectedAttachment,
  used: Set<string>,
) {
  const isSourceReport = project.soc2.sourceReport?.attachmentId === attachment.attachmentId;
  const directory = isSourceReport
    ? "04-soc2-bridge/selected-attachments"
    : "06-evidence-manifest/selected-attachments";
  const safeId = safeFilename(attachment.attachmentId, "attachment").replaceAll(" ", "-");
  const safeName = safeFilename(attachment.fileName, "attachment.bin");
  let path = `${directory}/${safeId}--${safeName}`;
  let counter = 2;
  while (used.has(path)) {
    path = `${directory}/${safeId}-${counter}--${safeName}`;
    counter += 1;
  }
  used.add(path);
  return path;
}

export async function generatePreparationPackage(
  project: BridgeProject,
  options: PreparationPackageOptions = {},
): Promise<PreparationPackage> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const officialOptions: OfficialDocumentOptions = {
    generatedAt,
    ...(options.officialDocuments ?? {}),
  };
  const official = createOfficialDocuments(project, officialOptions);
  const validation = summarizeValidation(official);
  const files = new Map<string, PendingFile>();
  const add = (
    path: string,
    bytes: Uint8Array,
    mediaType: string,
    category: PackageFileManifest["category"],
    containsUserProjectData = true,
  ) => {
    if (files.has(path)) throw new Error(`Duplicate package path: ${path}`);
    if (bytes.byteLength > MAX_SINGLE_FILE) throw new Error(`Package file is too large: ${path}`);
    files.set(path, { bytes, mediaType, category, containsUserProjectData });
  };

  add(
    "00-read-me/read-me.html",
    htmlBytes(readMeHtml(project, generatedAt)),
    "text/html;charset=utf-8",
    "human-readable",
  );
  add(
    "00-read-me/project-disclaimer.html",
    htmlBytes(projectDisclaimerHtml(project, generatedAt)),
    "text/html;charset=utf-8",
    "human-readable",
  );

  const cpoJson = serializeJsonArtifact(
    "certification-package-overview",
    official.certificationPackageOverview.value,
  );
  add(
    "01-certification-package-overview/certification-package-overview.json",
    cpoJson.bytes,
    cpoJson.mimeType,
    "official-json",
  );
  add(
    "01-certification-package-overview/certification-package-overview.html",
    htmlBytes(
      officialHtml(
        project,
        "Certification Package Overview draft",
        official.certificationPackageOverview,
      ),
    ),
    "text/html;charset=utf-8",
    "human-readable",
  );

  const sdrJson = serializeJsonArtifact(
    "security-decision-record",
    official.securityDecisionRecord.value,
  );
  add(
    "02-security-decision-record/security-decision-record.json",
    sdrJson.bytes,
    sdrJson.mimeType,
    "official-json",
  );
  add(
    "02-security-decision-record/security-decision-record.html",
    htmlBytes(
      officialHtml(project, "Security Decision Record draft", official.securityDecisionRecord),
    ),
    "text/html;charset=utf-8",
    "human-readable",
  );

  const ocrJson = serializeJsonArtifact(
    "ongoing-certification-report",
    official.ongoingCertificationReport.value,
  );
  add(
    "03-ongoing-certification-report/ongoing-certification-report.json",
    ocrJson.bytes,
    ocrJson.mimeType,
    "official-json",
  );
  add(
    "03-ongoing-certification-report/ongoing-certification-report.html",
    htmlBytes(
      officialHtml(
        project,
        "Ongoing Certification Report draft",
        official.ongoingCertificationReport,
      ),
    ),
    "text/html;charset=utf-8",
    "human-readable",
  );

  const mapping = generateHumanReport(project, "soc2-mapping", { generatedAt });
  add(
    "04-soc2-bridge/soc2-to-class-a-mapping.html",
    htmlBytes(mapping.html),
    mapping.mimeType,
    "human-readable",
  );
  const mappingCsv = generateCsv(project, "soc2-mapping");
  add(
    "04-soc2-bridge/soc2-to-class-a-mapping.csv",
    mappingCsv.bytes,
    mappingCsv.mimeType,
    "machine-readable",
  );
  add(
    "04-soc2-bridge/soc2-mapping-provenance.json",
    serializeJsonArtifact("soc2-mapping-provenance", {
      generatedAt,
      mappings: project.mappings.filter(isReviewedSoc2Mapping).map((item) => ({
        id: item.id,
        soc2ControlId: item.soc2ControlId,
        classARuleId: item.classARuleId,
        reportPage: item.reportPage,
        coverage: item.coverage,
        suggested: item.suggested,
        confirmed: item.confirmed,
        suggestionLevel: item.suggestionLevel ?? null,
        suggestionSource: item.suggestionSource ?? null,
        playbookContentVersion: item.playbookContentVersion ?? null,
        reviewOutcome: item.reviewOutcome ?? null,
        reviewer: item.reviewer ?? null,
        reviewDate: item.reviewDate ?? null,
        evidenceIds: item.evidenceIds ?? [],
      })),
      disclaimer:
        "A reviewed supporting SOC 2 mapping is supporting material only. It does not automatically satisfy a FedRAMP requirement or establish evidence sufficiency. Reviewed rejection, mismatch, exception, and expert-review outcomes establish no support.",
    }).bytes,
    "application/json",
    "machine-readable",
  );
  const materials = generateHumanReport(project, "external-materials", { generatedAt });
  add(
    "04-soc2-bridge/external-assessment-materials.html",
    htmlBytes(materials.html),
    materials.mimeType,
    "human-readable",
  );

  const scope = generateHumanReport(project, "scope-summary", { generatedAt });
  add("05-scope/scope-summary.html", htmlBytes(scope.html), scope.mimeType, "human-readable");

  const evidence = generateHumanReport(project, "evidence-manifest", { generatedAt });
  add(
    "06-evidence-manifest/evidence-manifest.html",
    htmlBytes(evidence.html),
    evidence.mimeType,
    "human-readable",
  );
  const evidenceCsv = generateCsv(project, "evidence-manifest");
  add(
    "06-evidence-manifest/evidence-manifest.csv",
    evidenceCsv.bytes,
    evidenceCsv.mimeType,
    "machine-readable",
  );

  const readiness = generateHumanReport(project, "executive-readiness", { generatedAt });
  add(
    "07-readiness-and-open-items/executive-readiness-summary.html",
    htmlBytes(readiness.html),
    readiness.mimeType,
    "human-readable",
  );
  const preliminary = generateHumanReport(project, "preliminary-fit", { generatedAt });
  add(
    "07-readiness-and-open-items/preliminary-fit-assessment.html",
    htmlBytes(preliminary.html),
    preliminary.mimeType,
    "human-readable",
  );
  const gap = generateHumanReport(project, "detailed-gap", { generatedAt });
  add(
    "07-readiness-and-open-items/detailed-gap-report.html",
    htmlBytes(gap.html),
    gap.mimeType,
    "human-readable",
  );
  const mandatory = generateHumanReport(project, "mandatory-requirements", { generatedAt });
  add(
    "07-readiness-and-open-items/mandatory-requirements-report.html",
    htmlBytes(mandatory.html),
    mandatory.mimeType,
    "human-readable",
  );
  const requirementsCsv = generateCsv(project, "requirements");
  add(
    "07-readiness-and-open-items/requirements.csv",
    requirementsCsv.bytes,
    requirementsCsv.mimeType,
    "machine-readable",
  );
  const openItems = generateHumanReport(project, "open-items", { generatedAt });
  add(
    "07-readiness-and-open-items/open-items.html",
    htmlBytes(openItems.html),
    openItems.mimeType,
    "human-readable",
  );
  add(
    "07-readiness-and-open-items/unresolved-items-report.html",
    htmlBytes(openItems.html),
    openItems.mimeType,
    "human-readable",
  );
  const actionCsv = generateCsv(project, "action-plan");
  add(
    "07-readiness-and-open-items/action-plan.csv",
    actionCsv.bytes,
    actionCsv.mimeType,
    "machine-readable",
  );
  const approval = generateHumanReport(project, "provider-approval", { generatedAt });
  add(
    "07-readiness-and-open-items/provider-approval-record.html",
    htmlBytes(approval.html),
    approval.mimeType,
    "human-readable",
  );
  const advisor = createAdvisorHandoff(project, { generatedAt });
  add(
    "07-readiness-and-open-items/advisor-handoff-report.html",
    htmlBytes(advisor.report.html),
    advisor.report.mimeType,
    "human-readable",
  );

  add(
    "08-validation/json-validation-report.html",
    htmlBytes(validationHtml(project, validation)),
    "text/html;charset=utf-8",
    "human-readable",
  );
  add(
    "08-validation/json-validation-report.json",
    serializeJsonArtifact("json-validation-report", validation).bytes,
    "application/json",
    "machine-readable",
  );
  const finalReview = createFinalReviewChecklist(project, validation, generatedAt);
  add(
    "08-validation/final-internal-review-checklist.html",
    htmlBytes(renderFinalReviewChecklist(project, finalReview)),
    "text/html;charset=utf-8",
    "human-readable",
  );
  add(
    "08-validation/final-internal-review-checklist.json",
    serializeJsonArtifact("final-internal-review-checklist", finalReview).bytes,
    "application/json",
    "machine-readable",
  );
  const sourceAndSchemaVersions = serializeJsonArtifact("source-and-schema-versions", {
    ruleCatalog: CATALOG_MANIFEST,
    schemas: official.schemaManifest,
  });
  add(
    "08-validation/rule-source-and-schema-version-manifest.json",
    sourceAndSchemaVersions.bytes,
    "application/json",
    "machine-readable",
    false,
  );
  add(
    "08-validation/source-and-schema-versions.json",
    sourceAndSchemaVersions.bytes,
    "application/json",
    "machine-readable",
    false,
  );

  const approvedIds = validAttachmentIds(project);
  const usedPaths = new Set(files.keys());
  const attachmentConsent: PreparationPackageManifest["attachmentConsent"][number][] = [];
  for (const attachment of options.selectedAttachments ?? []) {
    if (!attachment.userApproved) {
      throw new Error("Attachment export requires explicit user approval.");
    }
    if (!approvedIds.has(attachment.attachmentId)) {
      throw new Error(`Attachment ${attachment.attachmentId} is not referenced by this project.`);
    }
    const path = uniqueAttachmentPath(project, attachment, usedPaths);
    add(path, attachment.bytes.slice(), "application/octet-stream", "attachment");
    attachmentConsent.push({
      attachmentId: attachment.attachmentId,
      archivePath: path,
      userApproved: true,
    });
  }
  add(
    "08-validation/attachment-inclusion-report.json",
    serializeJsonArtifact("attachment-inclusion-report", {
      generatedAt,
      originalSoc2ReportIncluded: project.soc2.sourceReport
        ? attachmentConsent.some(
            ({ attachmentId }) => attachmentId === project.soc2.sourceReport?.attachmentId,
          )
        : false,
      includedAttachments: attachmentConsent,
      excludedByDefault: [
        "Original SOC 2 report",
        "Evidence attachments",
        "Incident materials",
        "Internal notes",
        "Unapproved SOC 2 mappings",
      ],
      consentRequired: true,
    }).bytes,
    "application/json",
    "machine-readable",
  );

  const indexPath = "00-read-me/package-index.html";
  const indexedPaths = [...files.keys(), indexPath, "manifest.json", "checksums.txt"].sort();
  add(
    indexPath,
    htmlBytes(packageIndexHtml(project, generatedAt, indexedPaths)),
    "text/html;charset=utf-8",
    "human-readable",
  );

  if (files.size > MAX_PACKAGE_FILES) throw new Error("Package contains too many files.");
  const expandedBytes = [...files.values()].reduce((sum, file) => sum + file.bytes.byteLength, 0);
  if (expandedBytes > MAX_EXPANDED_BYTES)
    throw new Error("Package exceeds the 100 MiB expanded limit.");

  const fileManifest: PackageFileManifest[] = [];
  for (const [path, file] of [...files.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    fileManifest.push({
      path,
      mediaType: file.mediaType,
      bytes: file.bytes.byteLength,
      sha256: await sha256Hex(file.bytes),
      category: file.category,
      containsUserProjectData: file.containsUserProjectData,
    });
  }
  const selectedSource = project.soc2.sourceReport?.attachmentId;
  const includedIds = new Set(attachmentConsent.map((entry) => entry.attachmentId));
  const sourceIncluded = Boolean(selectedSource && includedIds.has(selectedSource));
  const evidenceIncludedCount = project.evidence.filter(
    (item) => item.attachmentId && includedIds.has(item.attachmentId),
  ).length;
  const exclusions = [
    ...(!sourceIncluded ? ["Original SOC 2 report"] : []),
    ...(evidenceIncludedCount < project.evidence.filter((item) => item.attachmentId).length
      ? ["Unselected evidence attachments"]
      : []),
  ];
  const manifest: PreparationPackageManifest = {
    format: "class-a-bridge-preparation-package",
    formatVersion: 1,
    packageVersion: options.packageVersion ?? "draft-1",
    createdAt: generatedAt,
    project: {
      id: project.metadata.id,
      name: project.metadata.name,
      organization: project.organization.name,
      offering: project.offering.name,
      schemaVersion: project.metadata.schemaVersion,
      ruleCatalogVersion: project.metadata.ruleCatalogVersion,
    },
    regulatorySources: {
      ruleCatalog: {
        catalogVersion: CATALOG_MANIFEST.catalogVersion,
        commit: CATALOG_MANIFEST.commit,
        sourceUrl: CATALOG_MANIFEST.sourceUrl,
        verifiedAt: CATALOG_MANIFEST.verifiedAt,
      },
      schemas: official.schemaManifest,
    },
    files: fileManifest,
    exclusions,
    attachmentConsent,
    disclaimer: PREPARATION_DISCLAIMER,
  };
  const archive: Record<string, Uint8Array> = Object.fromEntries(
    [...files.entries()].map(([path, file]) => [path, file.bytes]),
  );
  archive["manifest.json"] = serializeJsonArtifact("manifest", manifest).bytes;
  archive["checksums.txt"] = encoder.encode(
    `${fileManifest.map((file) => `${file.sha256}  ${file.path}`).join("\n")}\n`,
  );
  const bytes = zipSync(archive, { level: 6 });
  const prefix = safeFilename(project.organization.name, "provider")
    .replaceAll(" ", "-")
    .toLowerCase();
  return {
    fileName: `${prefix}-class-a-preparation-package.zip`,
    mimeType: "application/zip",
    bytes,
    sha256: await sha256Hex(bytes),
    manifest,
    validation,
  };
}
