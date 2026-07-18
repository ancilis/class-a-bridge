import {
  MAX_ENCRYPTED_ENVELOPE_BYTES,
  MAX_PROJECT_BUNDLE_INPUT_BYTES,
  safeFilename,
  sha256Hex,
  type BridgeProject,
  type BundleAttachment,
  type BundleGeneratedOutput,
  type ImportedProjectBundle,
  type ProjectStore,
} from "@class-a-bridge/project";

export async function readProjectBackupFile(file: File): Promise<Uint8Array> {
  const encrypted = file.name.toLowerCase().endsWith(".encrypted");
  const maximumBytes = encrypted ? MAX_ENCRYPTED_ENVELOPE_BYTES : MAX_PROJECT_BUNDLE_INPUT_BYTES;
  if (file.size === 0) throw new Error("The selected project backup is empty.");
  if (file.size > maximumBytes) {
    throw new Error(
      `The selected project backup is too large. ${encrypted ? "Encrypted" : "Standard"} backups are limited to ${Math.floor(maximumBytes / (1024 * 1024))} MiB.`,
    );
  }
  return new Uint8Array(await file.arrayBuffer());
}

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

export interface ReferencedGeneratedOutput {
  readonly id: string;
  readonly fileName: string;
  readonly label: string;
  readonly sha256: string;
  readonly inline: boolean;
}

export function referencedGeneratedOutputs(
  project: BridgeProject,
): readonly ReferencedGeneratedOutput[] {
  const references: ReferencedGeneratedOutput[] = [];
  const seen = new Set<string>();
  for (const output of project.generatedOutputs) {
    if (seen.has(output.id)) {
      throw new Error(`Generated output identifier “${output.id}” is not unique.`);
    }
    seen.add(output.id);
    const extension = `.${output.format}`;
    const safeTitle = safeFilename(output.title, "class-a-bridge-output").slice(0, 170);
    references.push({
      id: output.id,
      fileName: safeTitle.toLowerCase().endsWith(extension)
        ? safeTitle
        : `${safeTitle}${extension}`,
      label: `Generated output — ${output.title}`,
      sha256: output.sha256,
      inline: output.content !== undefined,
    });
  }
  return references;
}

export async function collectBundleGeneratedOutputs(
  project: BridgeProject,
  store: ProjectStore,
  selectedIds: ReadonlySet<string>,
): Promise<readonly BundleGeneratedOutput[]> {
  const outputsById = new Map(project.generatedOutputs.map((output) => [output.id, output]));
  const outputs: BundleGeneratedOutput[] = [];
  for (const reference of referencedGeneratedOutputs(project)) {
    if (!selectedIds.has(reference.id)) continue;
    const output = outputsById.get(reference.id)!;
    const bytes =
      output.content === undefined
        ? await store.getAttachment(reference.id)
        : new TextEncoder().encode(output.content);
    if (!bytes) {
      throw new Error(
        `Selected generated output “${reference.label}” is unavailable in this browser storage backend.`,
      );
    }
    const actualHash = await sha256Hex(bytes);
    if (actualHash.toLowerCase() !== reference.sha256.toLowerCase()) {
      throw new Error(
        `Selected generated output “${reference.label}” failed its integrity check because its bytes do not match the project-record SHA-256 hash.`,
      );
    }
    outputs.push({ id: reference.id, fileName: reference.fileName, bytes });
  }
  return outputs;
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

export async function persistProjectWithGeneratedOutputAtomically(
  store: ProjectStore,
  project: BridgeProject,
  generatedOutput: { readonly id: string; readonly bytes: Uint8Array },
): Promise<boolean> {
  const matching = project.generatedOutputs.filter((output) => output.id === generatedOutput.id);
  if (matching.length !== 1) {
    throw new Error(
      `Generated output identifier “${generatedOutput.id}” must have exactly one project record before its bytes can be retained.`,
    );
  }
  const actualHash = await sha256Hex(generatedOutput.bytes);
  if (actualHash.toLowerCase() !== matching[0]!.sha256.toLowerCase()) {
    throw new Error(
      `Generated output “${matching[0]!.title}” failed its integrity check because its bytes do not match the project-record SHA-256 hash.`,
    );
  }

  if (store.supportsAttachments) {
    const [previousProject, previousBytes] = await Promise.all([
      store.load(project.metadata.id),
      store.getAttachment(generatedOutput.id),
    ]);
    if (
      previousBytes &&
      !previousProject?.generatedOutputs.some((output) => output.id === generatedOutput.id)
    ) {
      throw new Error(
        `Generated output identifier “${generatedOutput.id}” conflicts with unrelated local data.`,
      );
    }
  }

  return persistProjectWithAttachmentAtomically(store, project, generatedOutput);
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
  for (const mapping of next.mappings) {
    mapping.evidenceIds = mapping.evidenceIds?.filter((id) => id !== evidenceId);
  }
  for (const control of next.soc2.controls) {
    control.evidenceReferences = control.evidenceReferences?.filter((id) => id !== evidenceId);
  }
  next.metadata.updatedAt = new Date().toISOString();

  try {
    await store.save(next);
    if (evidence.attachmentId && !projectLocalByteIds(next).has(evidence.attachmentId)) {
      const owner = await store.getAttachmentOwner(evidence.attachmentId);
      const referencedElsewhere = await store.isAttachmentReferencedByOtherProject(
        evidence.attachmentId,
        project.metadata.id,
      );
      if (
        !referencedElsewhere &&
        ((owner?.kind === "owned" && owner.projectId === project.metadata.id) ||
          owner?.kind === "legacy-unowned")
      )
        await store.deleteAttachment(evidence.attachmentId);
    }
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

function projectLocalByteIds(project: BridgeProject): ReadonlySet<string> {
  const ids = new Set<string>();
  if (project.soc2.sourceReport) ids.add(project.soc2.sourceReport.attachmentId);
  for (const evidence of project.evidence) {
    if (evidence.attachmentId) ids.add(evidence.attachmentId);
  }
  for (const material of project.materials) {
    if (material.attachmentId) ids.add(material.attachmentId);
  }
  for (const output of project.generatedOutputs) ids.add(output.id);
  return ids;
}

function projectExpectedLocalByteHashes(
  project: BridgeProject,
): ReadonlyMap<string, ReadonlySet<string>> {
  const expected = new Map<string, Set<string>>();
  const add = (id: string, hash: string) => {
    const hashes = expected.get(id) ?? new Set<string>();
    hashes.add(hash.toLowerCase());
    expected.set(id, hashes);
  };
  if (project.soc2.sourceReport) {
    add(project.soc2.sourceReport.attachmentId, project.soc2.sourceReport.sha256);
  }
  for (const evidence of project.evidence) {
    if (evidence.attachmentId) add(evidence.attachmentId, evidence.sha256);
  }
  for (const output of project.generatedOutputs) add(output.id, output.sha256);
  return expected;
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

  const importedBytes = new Map<string, Uint8Array>();
  for (const [id, bytes] of imported.attachments) importedBytes.set(id, bytes);
  for (const [id, bytes] of imported.generatedOutputs) {
    if (importedBytes.has(id)) {
      throw new Error(`The backup reuses logical identifier “${id}” for multiple local files.`);
    }
    const output = imported.project.generatedOutputs.find((candidate) => candidate.id === id);
    if (!output || (await sha256Hex(bytes)).toLowerCase() !== output.sha256.toLowerCase()) {
      throw new Error(
        `The backup generated output “${id}” failed its project-record integrity check.`,
      );
    }
    importedBytes.set(id, bytes);
  }

  const previousIds = previousProject ? projectLocalByteIds(previousProject) : new Set<string>();
  const incomingIds = projectLocalByteIds(imported.project);
  const incomingExpectedHashes = projectExpectedLocalByteHashes(imported.project);
  const staleIds = new Set([...previousIds].filter((id) => !incomingIds.has(id)));

  // Attachment identifiers are globally keyed in browser storage. Reject every incoming
  // reference that resolves to another project's bytes, including metadata-only restores.
  for (const id of incomingIds) {
    const existing = await store.getAttachment(id);
    if (!existing) continue;
    const owner = await store.getAttachmentOwner(id);
    const legacyOwnedByThisProject =
      owner?.kind === "legacy-unowned" &&
      previousIds.has(id) &&
      !(await store.isAttachmentReferencedByOtherProject(id, imported.project.metadata.id));
    if (
      !(owner?.kind === "owned" && owner.projectId === imported.project.metadata.id) &&
      !legacyOwnedByThisProject
    ) {
      throw new Error(
        `The backup local-file identifier “${id}” conflicts with data owned by another local project. Import stopped safely.`,
      );
    }
  }

  // A backup can intentionally omit a referenced file. Retain a prior local copy only when
  // its bytes still match the incoming record; otherwise remove the stale copy after save.
  for (const id of incomingIds) {
    if (importedBytes.has(id)) continue;
    const expectedHashes = incomingExpectedHashes.get(id);
    if (!expectedHashes?.size) continue;
    const existing = await store.getAttachment(id);
    if (!existing) continue;
    const actualHash = (await sha256Hex(existing)).toLowerCase();
    if ([...expectedHashes].some((expectedHash) => expectedHash !== actualHash)) {
      staleIds.add(id);
    }
  }

  for (const id of [...staleIds]) {
    const owner = await store.getAttachmentOwner(id);
    const referencedElsewhere = await store.isAttachmentReferencedByOtherProject(
      id,
      imported.project.metadata.id,
    );
    if (
      referencedElsewhere ||
      (owner?.kind === "owned" && owner.projectId !== imported.project.metadata.id)
    )
      staleIds.delete(id);
  }

  const touchedIds = new Set([...importedBytes.keys(), ...staleIds]);
  const previousBytes = new Map<string, Uint8Array | undefined>();
  for (const id of touchedIds) {
    const previous = await store.getAttachment(id);
    if (importedBytes.has(id) && previous && !previousIds.has(id)) {
      throw new Error(
        `The backup local-file identifier “${id}” conflicts with unrelated local data. Import stopped safely.`,
      );
    }
    previousBytes.set(id, previous);
  }

  try {
    for (const [id, bytes] of importedBytes) {
      await store.putAttachment(id, bytes, imported.project.metadata.id);
    }
    await store.save(imported.project);
    for (const id of staleIds) await store.deleteAttachment(id);
  } catch (error) {
    try {
      if (previousProject) {
        await store.save(previousProject);
        for (const [id, previous] of previousBytes) {
          if (previous) await store.putAttachment(id, previous, previousProject.metadata.id);
          else await store.deleteAttachment(id);
        }
      } else {
        for (const id of touchedIds) await store.deleteAttachment(id);
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
