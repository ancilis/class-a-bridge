import { safeFilename, sha256Hex } from "@class-a-bridge/project";
import type { BridgeProject } from "@class-a-bridge/project";
import { CATALOG_MANIFEST } from "@class-a-bridge/rules";
import { zipSync } from "fflate";

import {
  callout,
  list,
  OFFICIAL_VALIDATOR_URL,
  PRINT_PDF_INSTRUCTIONS,
  PREPARATION_DISCLAIMER,
  renderStandaloneHtml,
  section,
  table,
  text,
} from "./html";
import { serializeJsonArtifact } from "./official";
import type {
  AdvisorHandoff,
  AdvisorHandoffModel,
  AdvisorHandoffOptions,
  AdvisorHandoffPackage,
  HumanReport,
  PackageFileManifest,
  PreparationPackageManifest,
  SelectedAttachment,
} from "./types";

const encoder = new TextEncoder();
const ADVISOR_EXCLUSIONS = [
  "Original SOC 2 report",
  "Evidence attachments",
  "Document-extraction candidates and source excerpts",
  "SOC 2 control excerpts and auditor-test details",
  "Requirement narratives and private notes",
  "Evidence descriptions, hashes, references, and notes",
  "Generated output bodies",
] as const;

const dueForReview = (reviewDate: string | undefined, generatedAt: string) =>
  Boolean(reviewDate && reviewDate < generatedAt.slice(0, 10));

export function createAdvisorHandoff(
  project: BridgeProject,
  options: AdvisorHandoffOptions = {},
): AdvisorHandoff {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const result = project.eligibility.result;
  const model: AdvisorHandoffModel = {
    format: "class-a-bridge-advisor-handoff",
    formatVersion: 1,
    generatedAt,
    project: {
      name: project.metadata.name,
      organization: project.organization.name,
      offering: project.offering.name,
      serviceModels: project.offering.serviceModels,
      ruleCatalogVersion: project.metadata.ruleCatalogVersion,
    },
    ...(result
      ? {
          preliminaryResult: {
            classification: result.classification,
            label: result.label,
            summary: result.summary,
            blockers: result.blockers,
            missingInformation: result.missingInformation,
            recommendedActions: result.recommendedActions,
          },
        }
      : {}),
    scope: {
      summary: project.scope.summary,
      includedResourceCount: project.scope.resources.filter((resource) => resource.included).length,
      thirdPartyCount: project.scope.resources.filter(
        (resource) => resource.kind === "third_party_cloud" || resource.kind === "service_provider",
      ).length,
      unresolvedQuestions: project.scope.questions,
      mismatchFindings: project.scope.mismatchFindings,
    },
    materials: project.materials.map((material) => ({
      kind: material.kind,
      status: material.status,
    })),
    requirements: project.requirements.map((requirement) => ({
      ruleId: requirement.ruleId,
      status: requirement.status,
      reviewStatus: requirement.reviewStatus,
      owner: requirement.owner,
      openQuestionCount: requirement.openQuestions.length,
    })),
    evidenceSummary: {
      totalCandidates: project.evidence.length,
      needsReview: project.evidence.filter((item) => item.reviewStatus !== "reviewed").length,
      staleOrDueForReview: project.evidence.filter((item) =>
        dueForReview(item.reviewDate, generatedAt),
      ).length,
    },
    actions: project.actions
      .filter((action) => action.status !== "done")
      .map((action) => ({
        title: action.title,
        category: action.category,
        priority: action.priority,
        status: action.status,
        owner: action.owner,
      })),
    advisorReviewFlags: project.advisorFlags,
    disclaimer: PREPARATION_DISCLAIMER,
  };
  const body = [
    callout(
      "This handoff is an allowlisted summary. It excludes source documents, attachments, excerpts, evidence details, narratives, and private notes unless the provider separately selects files for sharing.",
      "warning",
    ),
    section(
      "Preliminary result",
      result
        ? `<p><strong>${text(model.preliminaryResult?.label)}</strong></p><p>${text(model.preliminaryResult?.summary)}</p>`
        : '<p class="empty">No preliminary result recorded.</p>',
    ),
    section(
      "Scope summary",
      `<p>${text(model.scope.summary)}</p>${table(
        ["Included resources", "Third parties", "Unresolved questions", "Mismatch findings"],
        [
          [
            model.scope.includedResourceCount,
            model.scope.thirdPartyCount,
            model.scope.unresolvedQuestions.length,
            model.scope.mismatchFindings.length,
          ],
        ],
      )}`,
    ),
    section(
      "Requirement status",
      table(
        ["Rule", "Status", "Review", "Owner", "Open questions"],
        model.requirements.map((requirement) => [
          requirement.ruleId,
          requirement.status,
          requirement.reviewStatus,
          requirement.owner,
          requirement.openQuestionCount,
        ]),
      ),
    ),
    section(
      "Open action summary",
      table(
        ["Action", "Category", "Priority", "Status", "Owner"],
        model.actions.map((action) => [
          action.title,
          action.category,
          action.priority,
          action.status,
          action.owner,
        ]),
      ),
    ),
    section("Advisor-review flags", list(model.advisorReviewFlags)),
    section("Excluded by default", list(ADVISOR_EXCLUSIONS)),
  ].join("");
  const html = renderStandaloneHtml({
    title: "Advisor handoff report",
    organization: model.project.organization,
    offering: model.project.offering,
    generatedAt,
    body,
    ...(project.metadata.watermark ? { watermark: project.metadata.watermark } : {}),
  });
  const report: HumanReport = {
    kind: "advisor-handoff",
    title: "Advisor handoff report",
    fileName: "advisor-handoff.html",
    generatedAt,
    mimeType: "text/html;charset=utf-8",
    html,
    plainText:
      "Advisor handoff report. Review the HTML or JSON artifact for the allowlisted summary.",
    ...(project.metadata.watermark ? { watermark: project.metadata.watermark } : {}),
    pdfInstructions: PRINT_PDF_INSTRUCTIONS,
  };
  return {
    model,
    report,
    json: serializeJsonArtifact("advisor-handoff", model),
    exclusions: ADVISOR_EXCLUSIONS,
  };
}

function validAttachmentIds(project: BridgeProject) {
  return new Set(
    [
      project.soc2.sourceReport?.attachmentId,
      ...project.evidence.map((item) => item.attachmentId),
    ].filter((value): value is string => Boolean(value)),
  );
}

function attachmentPath(attachment: SelectedAttachment, usedPaths: Set<string>): string {
  const id = safeFilename(attachment.attachmentId, "attachment").replaceAll(" ", "-");
  const name = safeFilename(attachment.fileName, "attachment.bin");
  let path = `attachments/${id}--${name}`;
  let suffix = 2;
  while (usedPaths.has(path)) {
    path = `attachments/${id}-${suffix}--${name}`;
    suffix += 1;
  }
  usedPaths.add(path);
  return path;
}

export async function generateAdvisorHandoffPackage(
  project: BridgeProject,
  options: AdvisorHandoffOptions = {},
): Promise<AdvisorHandoffPackage> {
  const handoff = createAdvisorHandoff(project, options);
  const archive: Record<string, Uint8Array> = {
    "advisor-handoff.html": encoder.encode(handoff.report.html),
    "advisor-handoff.json": handoff.json.bytes,
  };
  const files: PackageFileManifest[] = [];
  for (const [path, bytes] of Object.entries(archive)) {
    files.push({
      path,
      mediaType: path.endsWith(".json") ? "application/json" : "text/html;charset=utf-8",
      bytes: bytes.byteLength,
      sha256: await sha256Hex(bytes),
      category: path.endsWith(".json") ? "machine-readable" : "human-readable",
      containsUserProjectData: true,
    });
  }
  const approvedIds = validAttachmentIds(project);
  const usedPaths = new Set(Object.keys(archive));
  const attachmentConsent: PreparationPackageManifest["attachmentConsent"][number][] = [];
  for (const attachment of options.selectedAttachments ?? []) {
    if (!attachment.userApproved) {
      throw new Error("Attachment export requires explicit user approval.");
    }
    if (!approvedIds.has(attachment.attachmentId)) {
      throw new Error(`Attachment ${attachment.attachmentId} is not referenced by this project.`);
    }
    if (attachment.bytes.byteLength > 25 * 1024 * 1024) {
      throw new Error(`Attachment ${attachment.fileName} exceeds the 25 MiB export limit.`);
    }
    const path = attachmentPath(attachment, usedPaths);
    archive[path] = attachment.bytes.slice();
    files.push({
      path,
      mediaType: "application/octet-stream",
      bytes: attachment.bytes.byteLength,
      sha256: await sha256Hex(attachment.bytes),
      category: "attachment",
      containsUserProjectData: true,
    });
    attachmentConsent.push({
      attachmentId: attachment.attachmentId,
      archivePath: path,
      userApproved: true,
    });
  }
  if (
    files.length > 200 ||
    files.reduce((total, file) => total + file.bytes, 0) > 100 * 1024 * 1024
  ) {
    throw new Error("Advisor handoff exceeds safe export limits.");
  }
  const includedIds = new Set(attachmentConsent.map((entry) => entry.attachmentId));
  const sourceId = project.soc2.sourceReport?.attachmentId;
  const evidenceAttachmentIds = project.evidence
    .map((item) => item.attachmentId)
    .filter((value): value is string => Boolean(value));
  const includedEvidenceCount = evidenceAttachmentIds.filter((id) => includedIds.has(id)).length;
  const exclusions = [
    ...(sourceId && !includedIds.has(sourceId) ? ["Original SOC 2 report"] : []),
    ...(includedEvidenceCount === 0 && evidenceAttachmentIds.length > 0
      ? ["Evidence attachments"]
      : includedEvidenceCount < evidenceAttachmentIds.length
        ? ["Unselected evidence attachments"]
        : []),
    ...ADVISOR_EXCLUSIONS.slice(2),
  ];
  const manifest: PreparationPackageManifest = {
    format: "class-a-bridge-preparation-package",
    formatVersion: 1,
    packageVersion: "advisor-handoff-1",
    createdAt: handoff.model.generatedAt,
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
      schemas: [],
    },
    files,
    exclusions,
    attachmentConsent,
    disclaimer: PREPARATION_DISCLAIMER,
  };
  archive["manifest.json"] = serializeJsonArtifact("manifest", manifest).bytes;
  const bytes = zipSync(archive, { level: 6 });
  return {
    fileName: `${safeFilename(project.organization.name, "provider").replaceAll(" ", "-").toLowerCase()}-advisor-handoff.zip`,
    mimeType: "application/zip",
    bytes,
    sha256: await sha256Hex(bytes),
    manifest,
    validation: {
      valid: true,
      checkedAt: handoff.model.generatedAt,
      documents: [],
      officialValidatorUrl: OFFICIAL_VALIDATOR_URL,
    },
    handoff,
  };
}
