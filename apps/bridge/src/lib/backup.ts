import {
  safeFilename,
  sha256Hex,
  type BridgeProject,
  type BundleAttachment,
  type ImportedProjectBundle,
  type ProjectStore,
} from "@class-a-bridge/project";

export interface ReferencedLocalAttachment {
  readonly id: string;
  readonly fileName: string;
  readonly label: string;
  readonly sensitivity: "confidential" | "restricted";
  readonly sha256: string;
}

export function referencedLocalAttachments(
  project: BridgeProject,
): readonly ReferencedLocalAttachment[] {
  const references: ReferencedLocalAttachment[] = [];
  const seen = new Set<string>();
  const sourceReport = project.soc2.sourceReport;
  if (sourceReport) {
    references.push({
      id: sourceReport.attachmentId,
      fileName: safeFilename(sourceReport.fileName),
      label: `Original SOC 2 report — ${sourceReport.fileName}`,
      sensitivity: "restricted",
      sha256: sourceReport.sha256,
    });
    seen.add(sourceReport.attachmentId);
  }
  for (const evidence of project.evidence) {
    if (!evidence.attachmentId || seen.has(evidence.attachmentId)) continue;
    const recordedFileName = /^Local file:\s*(.+)$/iu.exec(evidence.description)?.[1];
    references.push({
      id: evidence.attachmentId,
      fileName: recordedFileName
        ? safeFilename(recordedFileName)
        : `${safeFilename(evidence.title)}.bin`,
      label: `Evidence candidate — ${evidence.title}`,
      sensitivity: evidence.sensitivity === "restricted" ? "restricted" : "confidential",
      sha256: evidence.sha256,
    });
    seen.add(evidence.attachmentId);
  }
  return references;
}

export async function collectBundleAttachments(
  project: BridgeProject,
  store: ProjectStore,
  selectedIds: ReadonlySet<string>,
): Promise<readonly BundleAttachment[]> {
  const attachments: BundleAttachment[] = [];
  for (const reference of referencedLocalAttachments(project)) {
    if (!selectedIds.has(reference.id)) continue;
    const bytes = await store.getAttachment(reference.id);
    if (!bytes) {
      throw new Error(
        `Selected local attachment “${reference.label}” is unavailable in this browser storage backend.`,
      );
    }
    const actualHash = await sha256Hex(bytes);
    if (actualHash.toLowerCase() !== reference.sha256.toLowerCase()) {
      throw new Error(
        `Selected local attachment “${reference.label}” failed its integrity check because the stored bytes do not match the project-record SHA-256 hash.`,
      );
    }
    attachments.push({ id: reference.id, fileName: reference.fileName, bytes });
  }
  return attachments;
}

export async function persistProjectWithAttachmentAtomically(
  store: ProjectStore,
  project: BridgeProject,
  attachment: { readonly id: string; readonly bytes: Uint8Array },
): Promise<boolean> {
  if (!store.supportsAttachments) {
    await store.save(project);
    return false;
  }

  const previousProject = await store.load(project.metadata.id);
  const previousAttachment = await store.getAttachment(attachment.id);
  try {
    await store.putAttachment(attachment.id, attachment.bytes, project.metadata.id);
    await store.save(project);
  } catch (error) {
    try {
      if (previousAttachment) {
        await store.putAttachment(
          attachment.id,
          previousAttachment,
          previousProject?.metadata.id ?? project.metadata.id,
        );
      } else {
        await store.deleteAttachment(attachment.id);
      }
      if (previousProject) await store.save(previousProject);
      else await store.delete(project.metadata.id);
    } catch {
      throw new Error(
        "The local file was not retained because browser storage could not roll back a failed local save. Delete local data before retrying.",
        { cause: error },
      );
    }
    throw error;
  }
  return true;
}

export async function removeEvidenceCandidateLocally(
  store: ProjectStore,
  project: BridgeProject,
  evidenceId: string,
): Promise<BridgeProject> {
  const evidence = project.evidence.find((candidate) => candidate.id === evidenceId);
  if (!evidence) throw new Error("That evidence candidate is no longer present in this project.");

  const previousProject = structuredClone(project);
  const previousAttachment = evidence.attachmentId
    ? await store.getAttachment(evidence.attachmentId)
    : undefined;
  const next = structuredClone(project);
  next.evidence = next.evidence.filter((candidate) => candidate.id !== evidenceId);
  for (const requirement of next.requirements) {
    requirement.evidenceIds = requirement.evidenceIds.filter((id) => id !== evidenceId);
  }
  next.metadata.updatedAt = new Date().toISOString();

  try {
    await store.save(next);
    if (evidence.attachmentId) await store.deleteAttachment(evidence.attachmentId);
  } catch (error) {
    try {
      await store.save(previousProject);
      if (evidence.attachmentId && previousAttachment) {
        await store.putAttachment(
          evidence.attachmentId,
          previousAttachment,
          previousProject.metadata.id,
        );
      }
    } catch {
      throw new Error(
        "Evidence removal failed and browser storage could not restore the prior local record completely. Export a backup before continuing.",
        { cause: error },
      );
    }
    throw error;
  }

  return next;
}

export async function restoreImportedProjectAtomically(
  store: ProjectStore,
  imported: ImportedProjectBundle,
): Promise<BridgeProject> {
  const previousProject = await store.load(imported.project.metadata.id);
  if (!store.supportsAttachments) {
    try {
      await store.save(imported.project);
    } catch (error) {
      try {
        if (previousProject) await store.save(previousProject);
        else await store.delete(imported.project.metadata.id);
      } catch {
        throw new Error(
          "Backup restore failed and browser storage could not be rolled back completely. Export remaining projects before retrying.",
          { cause: error },
        );
      }
      throw error;
    }
    return structuredClone(imported.project);
  }
  const previousIds = previousProject
    ? new Set(referencedLocalAttachments(previousProject).map(({ id }) => id))
    : new Set<string>();
  const previousAttachments = new Map<string, Uint8Array | undefined>();

  for (const id of imported.attachments.keys()) {
    const previous = await store.getAttachment(id);
    if (previous && !previousIds.has(id)) {
      throw new Error(
        `The backup attachment identifier “${id}” conflicts with unrelated local data. Import stopped safely.`,
      );
    }
    previousAttachments.set(id, previous);
  }

  try {
    for (const [id, bytes] of imported.attachments) {
      await store.putAttachment(id, bytes, imported.project.metadata.id);
    }
    await store.save(imported.project);
  } catch (error) {
    try {
      if (previousProject) {
        await store.save(previousProject);
        for (const [id, previous] of previousAttachments) {
          if (previous) await store.putAttachment(id, previous, previousProject.metadata.id);
          else await store.deleteAttachment(id);
        }
      } else {
        for (const id of imported.attachments.keys()) await store.deleteAttachment(id);
        await store.delete(imported.project.metadata.id);
      }
    } catch {
      throw new Error(
        "Backup restore failed and browser storage could not be rolled back completely. Export remaining projects before retrying.",
        { cause: error },
      );
    }
    throw error;
  }

  return structuredClone(imported.project);
}
