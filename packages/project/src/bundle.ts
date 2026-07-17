import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { z } from "zod";

import { migrateProject } from "./migrations";
import {
  BridgeProjectSchema,
  PROJECT_SCHEMA_VERSION,
  RULE_CATALOG_VERSION,
  type BridgeProject,
} from "./model";
import { safeFilename, sha256Hex } from "./security";

const MAX_ARCHIVE_ENTRIES = 200;
const MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 100 * 1024 * 1024;

const BundleFileSchema = z
  .object({
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    bytes: z.number().int().nonnegative(),
    kind: z.enum(["project", "attachment", "migration", "generated_output"]),
  })
  .strict();

export const ProjectBundleManifestSchema = z
  .object({
    format: z.literal("class-a-bridge"),
    formatVersion: z.literal(1),
    createdAt: z.string().datetime(),
    projectId: z.string().min(1),
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    ruleCatalogVersion: z.literal(RULE_CATALOG_VERSION),
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
  ) => {
    if (!safeArchivePath(path)) throw new Error(`Unsafe project bundle path: ${path}`);
    if (bytes.byteLength > MAX_SINGLE_FILE_BYTES)
      throw new Error(`Project bundle file is too large: ${path}`);
    if (paths.has(path)) throw new Error(`Duplicate project bundle path: ${path}`);
    paths.add(path);
    archive[path] = bytes;
    files.push({ path, sha256: await sha256Hex(bytes), bytes: bytes.byteLength, kind });
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
    await addFile(path, attachment.bytes, "attachment");
  }
  for (const output of options.generatedOutputs ?? []) {
    const path = uniquePath("generated", output.id, output.fileName, paths);
    paths.delete(path);
    await addFile(path, output.bytes, "generated_output");
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
        expandedBytes > MAX_EXPANDED_BYTES
      ) {
        throw new Error("Project bundle exceeds safe import limits.");
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

  const declared = new Set(manifest.files.map((file) => file.path));
  for (const file of manifest.files) {
    if (!safeArchivePath(file.path))
      throw new Error(`Unsafe project bundle manifest path: ${file.path}`);
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
  try {
    project = migrateProject(JSON.parse(strFromU8(projectBytes)));
  } catch {
    throw new Error("Project bundle contains invalid or unsupported project data.");
  }
  if (project.metadata.id !== manifest.projectId)
    throw new Error("Project bundle identity does not match its manifest.");

  const attachments = new Map<string, Uint8Array>();
  const generatedOutputs = new Map<string, Uint8Array>();
  for (const file of manifest.files) {
    const bytes = archive[file.path];
    if (!bytes) continue;
    if (file.kind === "attachment") attachments.set(file.path, bytes.slice());
    if (file.kind === "generated_output") generatedOutputs.set(file.path, bytes.slice());
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
  delete project.soc2.sourceReport;
  project.soc2.extractionCandidates = [];
  project.soc2.controls = project.soc2.controls.map((control) => ({ ...control, excerpt: "" }));
  project.soc2.exceptions = project.soc2.exceptions.map((exception) => ({
    ...exception,
    description: "",
  }));
  project.requirements = project.requirements.map((requirement) => ({
    ...requirement,
    userResponse: "",
    implementationNarrative: "",
    verificationNarrative: "",
    validationNarrative: "",
    independentVerification: "",
    independentValidation: "",
    notes: "",
    exceptions: [],
  }));
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
  return BridgeProjectSchema.parse(project);
}
