import {
  LocalStorageProjectStore,
  MemoryProjectStore,
  sha256Hex,
  type ImportedProjectBundle,
  type ProjectStore,
} from "@class-a-bridge/project";
import { ACME_METRICS_PROJECT } from "@class-a-bridge/testing";
import { describe, expect, it } from "vitest";

import {
  collectBundleAttachments,
  persistProjectWithAttachmentAtomically,
  referencedLocalAttachments,
  removeEvidenceCandidateLocally,
  restoreImportedProjectAtomically,
} from "../src/lib/backup";

describe("local project backup orchestration", () => {
  it("persists an imported PDF project and its bytes before extraction review", async () => {
    const store = new MemoryProjectStore();
    const project = structuredClone(ACME_METRICS_PROJECT);
    const pdfBytes = new Uint8Array([1, 2, 3]);
    project.metadata.id = "pdf-project";
    project.soc2.sourceReport = {
      fileName: "report.pdf",
      attachmentId: "pdf-attachment",
      sha256: await sha256Hex(pdfBytes),
    };

    await persistProjectWithAttachmentAtomically(store, project, {
      id: "pdf-attachment",
      bytes: pdfBytes,
    });

    expect((await store.load(project.metadata.id))?.soc2.sourceReport?.attachmentId).toBe(
      "pdf-attachment",
    );
    expect(await store.getAttachment("pdf-attachment")).toEqual(pdfBytes);
  });

  it("removes staged PDF bytes if saving the extraction-review project fails", async () => {
    class FailingSaveStore extends MemoryProjectStore {
      override save(): Promise<void> {
        return Promise.reject(new Error("simulated project save failure"));
      }
    }
    const store = new FailingSaveStore();
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.metadata.id = "failed-pdf-project";

    await expect(
      persistProjectWithAttachmentAtomically(store, project, {
        id: "failed-pdf-attachment",
        bytes: new Uint8Array([9, 8, 7]),
      }),
    ).rejects.toThrow(/simulated project save failure/iu);
    expect(await store.load(project.metadata.id)).toBeUndefined();
    expect(await store.getAttachment("failed-pdf-attachment")).toBeUndefined();
  });

  it("loads only explicitly selected local attachments for standard or encrypted backup", async () => {
    const project = structuredClone(ACME_METRICS_PROJECT);
    const sourceReportBytes = new Uint8Array([1, 2, 3]);
    project.soc2.sourceReport = {
      fileName: "acme-soc2.pdf",
      attachmentId: "soc2-selected",
      sha256: await sha256Hex(sourceReportBytes),
    };
    project.evidence[0] = {
      ...project.evidence[0]!,
      attachmentId: "evidence-not-selected",
      description: "Local file: passwordless-report.csv",
    };
    const store = new MemoryProjectStore();
    await store.putAttachment("soc2-selected", sourceReportBytes, project.metadata.id);
    await store.putAttachment(
      "evidence-not-selected",
      new Uint8Array([4, 5, 6]),
      project.metadata.id,
    );

    const references = referencedLocalAttachments(project);
    expect(references.map(({ id }) => id)).toEqual(["soc2-selected", "evidence-not-selected"]);
    const selected = await collectBundleAttachments(project, store, new Set(["soc2-selected"]));

    expect(selected).toEqual([
      expect.objectContaining({ id: "soc2-selected", fileName: "acme-soc2.pdf" }),
    ]);
  });

  it("rejects selected local bytes that no longer match the project-record hash", async () => {
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.soc2.sourceReport = {
      fileName: "tampered-soc2.pdf",
      attachmentId: "tampered-source",
      sha256: await sha256Hex(new Uint8Array([1, 2, 3])),
    };
    const store = new MemoryProjectStore();
    await store.putAttachment(
      "tampered-source",
      new Uint8Array([9, 9, 9]),
      project.metadata.id,
    );

    await expect(
      collectBundleAttachments(project, store, new Set(["tampered-source"])),
    ).rejects.toThrow(/integrity.*hash/iu);
  });

  it("removes an evidence record, its requirement references, and its owned local bytes", async () => {
    const store = new MemoryProjectStore();
    const project = structuredClone(ACME_METRICS_PROJECT);
    const evidence = project.evidence[0]!;
    evidence.attachmentId = "evidence-to-remove";
    project.requirements[0]!.evidenceIds = [evidence.id];
    await store.save(project);
    await store.putAttachment(
      evidence.attachmentId,
      new Uint8Array([5, 4, 3]),
      project.metadata.id,
    );

    const next = await removeEvidenceCandidateLocally(store, project, evidence.id);

    expect(next.evidence.some((candidate) => candidate.id === evidence.id)).toBe(false);
    expect(next.requirements[0]?.evidenceIds).not.toContain(evidence.id);
    expect((await store.load(project.metadata.id))?.evidence).not.toContainEqual(
      expect.objectContaining({ id: evidence.id }),
    );
    expect(await store.getAttachment(evidence.attachmentId)).toBeUndefined();
  });

  it("restores evidence metadata and bytes if local attachment deletion fails", async () => {
    class FailingDeleteStore extends MemoryProjectStore {
      fail = false;
      override deleteAttachment(id: string): Promise<void> {
        if (this.fail && id === "undeletable-evidence")
          return Promise.reject(new Error("simulated attachment deletion failure"));
        return super.deleteAttachment(id);
      }
    }
    const store = new FailingDeleteStore();
    const project = structuredClone(ACME_METRICS_PROJECT);
    const evidence = project.evidence[0]!;
    evidence.attachmentId = "undeletable-evidence";
    await store.save(project);
    await store.putAttachment(
      evidence.attachmentId,
      new Uint8Array([8, 8, 8]),
      project.metadata.id,
    );
    store.fail = true;

    await expect(
      removeEvidenceCandidateLocally(store, project, evidence.id),
    ).rejects.toThrow(/simulated attachment deletion failure/iu);
    expect((await store.load(project.metadata.id))?.evidence).toContainEqual(
      expect.objectContaining({ id: evidence.id }),
    );
    expect(await store.getAttachment(evidence.attachmentId)).toEqual(new Uint8Array([8, 8, 8]));
  });

  it("keeps the current project and attachments intact if a restore write fails", async () => {
    class FailingAttachmentStore extends MemoryProjectStore {
      fail = false;
      override putAttachment(id: string, bytes: Uint8Array, projectId?: string): Promise<void> {
        if (this.fail && id === "incoming-second")
          return Promise.reject(new Error("simulated attachment write failure"));
        return super.putAttachment(id, bytes, projectId);
      }
    }
    const store = new FailingAttachmentStore();
    const current = structuredClone(ACME_METRICS_PROJECT);
    current.metadata.id = "restored-project";
    current.metadata.name = "Current project";
    current.soc2.sourceReport = {
      fileName: "current.pdf",
      attachmentId: "incoming-first",
      sha256: "a".repeat(64),
    };
    await store.save(current);
    await store.putAttachment("incoming-first", new Uint8Array([9, 9, 9]), current.metadata.id);

    const incoming = structuredClone(current);
    incoming.metadata.name = "Incoming project";
    incoming.evidence[0] = {
      ...incoming.evidence[0]!,
      attachmentId: "incoming-second",
      description: "Local file: evidence.txt",
    };
    const imported = {
      project: incoming,
      manifest: {},
      attachments: new Map([
        ["incoming-first", new Uint8Array([1])],
        ["incoming-second", new Uint8Array([2])],
      ]),
      generatedOutputs: new Map(),
    } as unknown as ImportedProjectBundle;
    store.fail = true;

    await expect(restoreImportedProjectAtomically(store, imported)).rejects.toThrow(
      /simulated attachment write failure/iu,
    );
    expect((await store.load(current.metadata.id))?.metadata.name).toBe("Current project");
    expect(await store.getAttachment("incoming-first")).toEqual(new Uint8Array([9, 9, 9]));
    expect(await store.getAttachment("incoming-second")).toBeUndefined();
  });

  it("removes staged attachment bytes when a new-project restore fails", async () => {
    class NonCascadingFailingStore extends MemoryProjectStore {
      override putAttachment(id: string, bytes: Uint8Array, projectId?: string): Promise<void> {
        if (id === "staged-second") return Promise.reject(new Error("staging failed"));
        return super.putAttachment(id, bytes, projectId);
      }
      override delete(): Promise<void> {
        return Promise.resolve();
      }
    }
    const store = new NonCascadingFailingStore();
    const incoming = structuredClone(ACME_METRICS_PROJECT);
    incoming.metadata.id = "new-import";
    const imported = {
      project: incoming,
      manifest: {},
      attachments: new Map([
        ["staged-first", new Uint8Array([1])],
        ["staged-second", new Uint8Array([2])],
      ]),
      generatedOutputs: new Map(),
    } as unknown as ImportedProjectBundle;

    await expect(restoreImportedProjectAtomically(store, imported)).rejects.toThrow(
      /staging failed/iu,
    );
    expect(await store.getAttachment("staged-first")).toBeUndefined();
    expect(await store.getAttachment("staged-second")).toBeUndefined();
  });

  it("restores project metadata when the browser fallback cannot retain bundled attachments", async () => {
    const storage = globalThis.localStorage;
    storage.clear();
    const store: ProjectStore = new LocalStorageProjectStore(storage);
    const incoming = structuredClone(ACME_METRICS_PROJECT);
    incoming.metadata.id = "fallback-import";
    incoming.soc2.sourceReport = {
      fileName: "source-report.pdf",
      attachmentId: "fallback-source-report",
      sha256: await sha256Hex(new Uint8Array([1, 2, 3])),
    };
    const imported = {
      project: incoming,
      manifest: {},
      attachments: new Map([["fallback-source-report", new Uint8Array([1, 2, 3])]]),
      generatedOutputs: new Map(),
    } as unknown as ImportedProjectBundle;

    const restored = await restoreImportedProjectAtomically(store, imported);

    expect(restored.metadata.id).toBe("fallback-import");
    expect((await store.load("fallback-import"))?.soc2.sourceReport?.attachmentId).toBe(
      "fallback-source-report",
    );
    expect(await store.getAttachment("fallback-source-report")).toBeUndefined();
  });
});
