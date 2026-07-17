import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { z } from "zod";

import { migrateProject } from "./migrations";
import { BridgeProjectSchema, PROJECT_SCHEMA_VERSION, type BridgeProject } from "./model";
import { safeFilename, sha256Hex } from "./security";

const MAX_ARCHIVE_ENTRIES = 200;
const MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 100 * 1024 * 1024;
export const MAX_PROJECT_BUNDLE_INPUT_BYTES = MAX_EXPANDED_BYTES + 1024 * 1024;

const BundleFileSchema = z
  .object({
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    bytes: z.number().int().nonnegative(),
    kind: z.enum(["project", "attachment", "migration", "generated_output"]),
    logicalId: z.string().min(1).optional(),
  })
  .strict();

export const ProjectBundleManifestSchema = z
  .object({
    format: z.literal("class-a-bridge"),
    formatVersion: z.literal(1),
    createdAt: z.string().datetime(),
    projectId: z.string().min(1),
    schemaVersion: z.number().int().nonnegative().max(PROJECT_SCHEMA_VERSION),
    ruleCatalogVersion: z.string().min(1),
    files: z.array(BundleFileSchema).max(MAX_ARCHIVE_ENTRIES),
    migrationHistory: z.array(
      z
        .object({
          id: z.string(),
          from: z.number().int().nonnegative(),
          to: z.number().int().positive(),
          appliedAt: z.string().datetime(),
        })
        .strict(),
    ),
  })
  .strict();

export type ProjectBundleManifest = z.infer<typeof ProjectBundleManifestSchema>;

export interface BundleAttachment {
  readonly id: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface BundleGeneratedOutput {
  readonly id: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export interface ProjectBundleOptions {
  /** Attachments are opt-in so an original SOC 2 report is never silently exported. */
  readonly attachments?: readonly BundleAttachment[];
  readonly generatedOutputs?: readonly BundleGeneratedOutput[];
}

export interface ImportedProjectBundle {
  readonly project: BridgeProject;
  readonly manifest: ProjectBundleManifest;
  readonly attachments: ReadonlyMap<string, Uint8Array>;
  readonly generatedOutputs: ReadonlyMap<string, Uint8Array>;
}

function safeArchivePath(path: string): boolean {
  if (!path || path.includes("\0") || path.includes("\\") || path.startsWith("/")) return false;
  const parts = path.split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}

function uniquePath(prefix: string, id: string, fileName: string, existing: Set<string>): string {
  const safeId = safeFilename(id, "item").replaceAll(" ", "-");
  const safeName = safeFilename(fileName);
  let path = `${prefix}/${safeId}--${safeName}`;
  let suffix = 2;
  while (existing.has(path)) {
    path = `${prefix}/${safeId}-${suffix}--${safeName}`;
    suffix += 1;
  }
  existing.add(path);
  return path;
}

interface AttachmentReference {
  readonly expectedHashes: Set<string>;
}

function projectAttachmentReferences(
  project: BridgeProject,
): ReadonlyMap<string, AttachmentReference> {
  const references = new Map<string, AttachmentReference>();
  const addReference = (logicalId: string, expectedHash?: string) => {
    const reference = references.get(logicalId) ?? { expectedHashes: new Set<string>() };
    if (expectedHash) reference.expectedHashes.add(expectedHash);
    references.set(logicalId, reference);
  };

  if (project.soc2.sourceReport) {
    addReference(project.soc2.sourceReport.attachmentId, project.soc2.sourceReport.sha256);
  }
  for (const evidence of project.evidence) {
    if (evidence.attachmentId) addReference(evidence.attachmentId, evidence.sha256);
  }
  for (const material of project.materials) {
    if (material.attachmentId) addReference(material.attachmentId);
  }
  return references;
}

function projectGeneratedOutputHashes(
  project: BridgeProject,
): ReadonlyMap<string, ReadonlySet<string>> {
  const references = new Map<string, Set<string>>();
  for (const output of project.generatedOutputs) {
    const hashes = references.get(output.id) ?? new Set<string>();
    hashes.add(output.sha256);
    references.set(output.id, hashes);
  }
  return references;
}

function validateIncludedFileReferences(
  project: BridgeProject,
  manifest: ProjectBundleManifest,
): void {
  const attachmentReferences = projectAttachmentReferences(project);
  const generatedOutputHashes = projectGeneratedOutputHashes(project);

  for (const file of manifest.files) {
    if (file.kind === "attachment") {
      const logicalId = file.logicalId!;
      const reference = attachmentReferences.get(logicalId);
      if (!reference) {
        throw new Error(
          `Project bundle attachment logical ID ${logicalId} is not referenced by the project.`,
        );
      }
      if ([...reference.expectedHashes].some((expectedHash) => expectedHash !== file.sha256)) {
        throw new Error(`Project bundle attachment ${logicalId} does not match the project hash.`);
      }
    }

    if (file.kind === "generated_output") {
      const logicalId = file.logicalId!;
      const expectedHashes = generatedOutputHashes.get(logicalId);
      if (!expectedHashes) {
        throw new Error(
          `Project bundle generated output logical ID ${logicalId} is not referenced by the project.`,
        );
      }
      if ([...expectedHashes].some((expectedHash) => expectedHash !== file.sha256)) {
        throw new Error(
          `Project bundle generated output ${logicalId} does not match the project hash.`,
        );
      }
    }
  }
}

export async function exportProjectBundle(
  projectInput: BridgeProject,
  options: ProjectBundleOptions = {},
): Promise<Uint8Array> {
  const project = BridgeProjectSchema.parse(projectInput);
  const archive: Record<string, Uint8Array> = {};
  const paths = new Set<string>();
  const files: ProjectBundleManifest["files"][number][] = [];

  const addFile = async (
    path: string,
    bytes: Uint8Array,
    kind: ProjectBundleManifest["files"][number]["kind"],
    logicalId?: string,
  ) => {
    if (!safeArchivePath(path)) throw new Error(`Unsafe project bundle path: ${path}`);
    if (bytes.byteLength > MAX_SINGLE_FILE_BYTES)
      throw new Error(`Project bundle file is too large: ${path}`);
    if (paths.has(path)) throw new Error(`Duplicate project bundle path: ${path}`);
    paths.add(path);
    archive[path] = bytes;
    files.push({
      path,
      sha256: await sha256Hex(bytes),
      bytes: bytes.byteLength,
      kind,
      ...(logicalId ? { logicalId } : {}),
    });
  };

  await addFile("project/project.json", strToU8(JSON.stringify(project, null, 2)), "project");
  await addFile(
    "migration/metadata.json",
    strToU8(
      JSON.stringify(
        { schemaVersion: project.metadata.schemaVersion, history: project.metadata.migrations },
        null,
        2,
      ),
    ),
    "migration",
  );

  for (const attachment of options.attachments ?? []) {
    const path = uniquePath("attachments", attachment.id, attachment.fileName, paths);
    // uniquePath reserves the path; addFile performs the canonical duplicate check.
    paths.delete(path);
    await addFile(path, attachment.bytes, "attachment", attachment.id);
  }
  for (const output of options.generatedOutputs ?? []) {
    const path = uniquePath("generated", output.id, output.fileName, paths);
    paths.delete(path);
    await addFile(path, output.bytes, "generated_output", output.id);
  }

  const expandedBytes = files.reduce((total, file) => total + file.bytes, 0);
  if (files.length > MAX_ARCHIVE_ENTRIES || expandedBytes > MAX_EXPANDED_BYTES) {
    throw new Error("Project bundle exceeds the safe export limit.");
  }

  const manifest = ProjectBundleManifestSchema.parse({
    format: "class-a-bridge",
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    projectId: project.metadata.id,
    schemaVersion: project.metadata.schemaVersion,
    ruleCatalogVersion: project.metadata.ruleCatalogVersion,
    files,
    migrationHistory: project.metadata.migrations,
  });
  archive["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  archive["checksums.txt"] = strToU8(
    `${files.map((file) => `${file.sha256}  ${file.path}`).join("\n")}\n`,
  );

  return zipSync(archive, { level: 6 });
}

export async function importProjectBundle(input: Uint8Array): Promise<ImportedProjectBundle> {
  if (input.byteLength > MAX_PROJECT_BUNDLE_INPUT_BYTES) {
    throw new Error("Compressed project bundle exceeds the safe import limit.");
  }
  let entryCount = 0;
  let expandedBytes = 0;
  const names = new Set<string>();
  const archive = unzipSync(input, {
    filter(file) {
      entryCount += 1;
      expandedBytes += file.originalSize;
      if (!safeArchivePath(file.name)) throw new Error(`Unsafe project bundle path: ${file.name}`);
      if (names.has(file.name)) throw new Error(`Duplicate project bundle path: ${file.name}`);
      names.add(file.name);
      if (
        entryCount > MAX_ARCHIVE_ENTRIES ||
        file.originalSize > MAX_SINGLE_FILE_BYTES ||
        expandedBytes > MAX_EXPANDED_BYTES ||
        (file.originalSize > 1024 * 1024 && file.originalSize / Math.max(file.size, 1) > 100)
      ) {
        throw new Error("Project bundle exceeds safe import or compression-ratio limits.");
      }
      return true;
    },
  });

  const manifestBytes = archive["manifest.json"];
  const projectBytes = archive["project/project.json"];
  if (!manifestBytes || !projectBytes)
    throw new Error("Project bundle manifest or project file is missing.");

  let manifest: ProjectBundleManifest;
  try {
    manifest = ProjectBundleManifestSchema.parse(JSON.parse(strFromU8(manifestBytes)));
  } catch {
    throw new Error("Project bundle manifest is invalid.");
  }

  const declared = new Set<string>();
  const logicalIds = new Set<string>();
  for (const file of manifest.files) {
    if (!safeArchivePath(file.path))
      throw new Error(`Unsafe project bundle manifest path: ${file.path}`);
    if (declared.has(file.path))
      throw new Error(`Duplicate project bundle manifest path: ${file.path}`);
    declared.add(file.path);
    if (file.kind === "attachment" || file.kind === "generated_output") {
      if (!file.logicalId)
        throw new Error(`Project bundle ${file.kind} entries require a logical ID.`);
    }
    if (file.logicalId) {
      if (logicalIds.has(file.logicalId))
        throw new Error(`Project bundle has a duplicate logical ID: ${file.logicalId}.`);
      logicalIds.add(file.logicalId);
    }
    const bytes = archive[file.path];
    if (!bytes || bytes.byteLength !== file.bytes || (await sha256Hex(bytes)) !== file.sha256) {
      throw new Error(`Project bundle integrity check failed for ${file.path}.`);
    }
  }

  for (const path of Object.keys(archive)) {
    if (path !== "manifest.json" && path !== "checksums.txt" && !declared.has(path)) {
      throw new Error(`Project bundle contains an undeclared file: ${path}`);
    }
  }

  let project: BridgeProject;
  let rawProject: unknown;
  try {
    rawProject = JSON.parse(strFromU8(projectBytes));
    project = migrateProject(rawProject);
  } catch {
    throw new Error("Project bundle contains invalid or unsupported project data.");
  }
  const rawRecord =
    typeof rawProject === "object" && rawProject !== null
      ? (rawProject as Record<string, unknown>)
      : undefined;
  const rawMetadata =
    typeof rawRecord?.["metadata"] === "object" && rawRecord["metadata"] !== null
      ? (rawRecord["metadata"] as Record<string, unknown>)
      : undefined;
  const rawSchemaVersion = rawMetadata?.["schemaVersion"] ?? rawRecord?.["schemaVersion"];
  const currentManifestMatches =
    manifest.schemaVersion !== PROJECT_SCHEMA_VERSION ||
    (project.metadata.id === manifest.projectId &&
      project.metadata.schemaVersion === manifest.schemaVersion &&
      project.metadata.ruleCatalogVersion === manifest.ruleCatalogVersion &&
      JSON.stringify(project.metadata.migrations) === JSON.stringify(manifest.migrationHistory));
  if (rawSchemaVersion !== manifest.schemaVersion || !currentManifestMatches) {
    throw new Error("Project bundle manifest metadata does not match the project record.");
  }

  validateIncludedFileReferences(project, manifest);

  const attachments = new Map<string, Uint8Array>();
  const generatedOutputs = new Map<string, Uint8Array>();
  for (const file of manifest.files) {
    const bytes = archive[file.path];
    if (!bytes) continue;
    if (file.kind === "attachment") attachments.set(file.logicalId!, bytes.slice());
    if (file.kind === "generated_output") generatedOutputs.set(file.logicalId!, bytes.slice());
  }
  return { project, manifest, attachments, generatedOutputs };
}

/**
 * Produces a strict redacted copy for advisor handoff. It intentionally keeps
 * titles and status context while removing attachments, excerpts, narratives,
 * general notes, source-document metadata, and generated document bodies.
 */
export function projectForAdvisor(projectInput: BridgeProject): BridgeProject {
  const project = structuredClone(BridgeProjectSchema.parse(projectInput));
  project.notes = "";
  project.packageInputs.certificationPackageOverview.ueiNumber = "";
  project.packageInputs.certificationPackageOverview.securityContact = {
    name: "",
    email: "",
    phone: "",
  };
  project.packageInputs.certificationPackageOverview.salesContact = {
    name: "",
    email: "",
    phone: "",
  };
  delete project.soc2.sourceReport;
  project.soc2.extractionCandidates = [];
  project.soc2.controls = project.soc2.controls.map((control) => ({ ...control, excerpt: "" }));
  project.soc2.exceptions = project.soc2.exceptions.map((exception) => ({
    ...exception,
    description: "",
  }));
  project.requirements = project.requirements.map((requirement) => {
    const redacted = {
      ...requirement,
      ...(requirement.status === "approved_by_provider"
        ? { status: "needs_expert_review" as const, reviewStatus: "unreviewed" as const }
        : {}),
      userResponse: "",
      implementationNarrative: "",
      verificationNarrative: "",
      validationNarrative: "",
      independentVerification: "",
      independentValidation: "",
      notes: "",
      exceptions: [],
    };
    delete redacted.providerApprovedBy;
    delete redacted.providerApprovedAt;
    return redacted;
  });
  project.evidence = project.evidence.map((item) => {
    const redacted = { ...item, description: "", notes: "" };
    delete redacted.attachmentId;
    delete redacted.externalUrl;
    return redacted;
  });
  project.mappings = project.mappings.map((mapping) => ({ ...mapping, excerpt: "" }));
  project.generatedOutputs = project.generatedOutputs.map((output) => {
    const redacted = { ...output };
    delete redacted.content;
    return redacted;
  });
  project.approvals = project.approvals.map((approval) => ({ ...approval, notes: "" }));
  return BridgeProjectSchema.parse(project);
}
