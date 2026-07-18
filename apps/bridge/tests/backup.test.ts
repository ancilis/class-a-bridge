import {
  LocalStorageProjectStore,
  MAX_ENCRYPTED_ENVELOPE_BYTES,
  MAX_PROJECT_BUNDLE_INPUT_BYTES,
  MemoryProjectStore,
  sha256Hex,
  type ImportedProjectBundle,
  type ProjectStore,
} from "@class-a-bridge/project";
import { ACME_METRICS_PROJECT } from "@class-a-bridge/testing";
import { describe, expect, it } from "vitest";

import {
  collectBundleAttachments,
  collectBundleGeneratedOutputs,
  persistProjectWithAttachmentAtomically,
  persistProjectWithGeneratedOutputAtomically,
  referencedLocalAttachments,
  referencedGeneratedOutputs,
  removeEvidenceCandidateLocally,
  readProjectBackupFile,
  restoreImportedProjectAtomically,
} from "../src/lib/backup";

describe("local project backup orchestration", () => {
  it.each([
    ["oversized.classabridge", MAX_PROJECT_BUNDLE_INPUT_BYTES + 1],
    ["oversized.classabridge.encrypted", MAX_ENCRYPTED_ENVELOPE_BYTES + 1],
  ])("rejects %s before reading the user-selected file into memory", async (name, size) => {
    let read = false;
    const file = {
      name,
      size,
      arrayBuffer: () => {
        read = true;
        return Promise.resolve(new ArrayBuffer(0));
      },
    } as File;

    await expect(readProjectBackupFile(file)).rejects.toThrow(/too large/iu);
    expect(read).toBe(false);
  });

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
    await store.putAttachment("tampered-source", new Uint8Array([9, 9, 9]), project.metadata.id);

    await expect(
      collectBundleAttachments(project, store, new Set(["tampered-source"])),
    ).rejects.toThrow(/integrity.*hash/iu);
  });

  it("enumerates and verifies inline and locally stored generated outputs", async () => {
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.generatedOutputs = [];
    const inlineContent = "<h1>Internal readiness summary</h1>";
    const storedBytes = new Uint8Array([80, 75, 3, 4]);
    project.generatedOutputs.push(
      {
        id: "output-inline",
        kind: "readiness_report",
        title: "Readiness summary",
        format: "html",
        generatedAt: "2026-07-17T12:00:00.000Z",
        sha256: await sha256Hex(new TextEncoder().encode(inlineContent)),
        content: inlineContent,
        validationStatus: "not_applicable",
        validationIssues: [],
      },
      {
        id: "output-package",
        kind: "preparation_package",
        title: "Preparation package 1.0",
        format: "zip",
        generatedAt: "2026-07-17T12:00:00.000Z",
        sha256: await sha256Hex(storedBytes),
        validationStatus: "valid",
        validationIssues: [],
      },
    );
    const store = new MemoryProjectStore();
    await store.putAttachment("output-package", storedBytes, project.metadata.id);

    expect(referencedGeneratedOutputs(project)).toEqual([
      expect.objectContaining({
        id: "output-inline",
        fileName: "Readiness summary.html",
        inline: true,
      }),
      expect.objectContaining({
        id: "output-package",
        fileName: "Preparation package 1.0.zip",
        inline: false,
      }),
    ]);

    const selected = await collectBundleGeneratedOutputs(
      project,
      store,
      new Set(["output-inline", "output-package"]),
    );
    expect(selected).toEqual([
      expect.objectContaining({
        id: "output-inline",
        bytes: new TextEncoder().encode(inlineContent),
      }),
      expect.objectContaining({ id: "output-package", bytes: storedBytes }),
    ]);
  });

  it("keeps every fictional sample output internally hash-consistent", async () => {
    const store = new MemoryProjectStore();
    const selectedIds = new Set(ACME_METRICS_PROJECT.generatedOutputs.map(({ id }) => id));

    await expect(
      collectBundleGeneratedOutputs(ACME_METRICS_PROJECT, store, selectedIds),
    ).resolves.toHaveLength(ACME_METRICS_PROJECT.generatedOutputs.length);
  });

  it("rejects generated output bytes or inline content that do not match recorded hashes", async () => {
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.generatedOutputs = [
      {
        id: "output-inline-tampered",
        kind: "readiness_report",
        title: "Readiness summary",
        format: "html",
        generatedAt: "2026-07-17T12:00:00.000Z",
        sha256: await sha256Hex(new TextEncoder().encode("expected")),
        content: "changed",
        validationStatus: "not_applicable",
        validationIssues: [],
      },
      {
        id: "output-stored-tampered",
        kind: "preparation_package",
        title: "Preparation package",
        format: "zip",
        generatedAt: "2026-07-17T12:00:00.000Z",
        sha256: await sha256Hex(new Uint8Array([1, 2, 3])),
        validationStatus: "valid",
        validationIssues: [],
      },
    ];
    const store = new MemoryProjectStore();
    await store.putAttachment(
      "output-stored-tampered",
      new Uint8Array([9, 9, 9]),
      project.metadata.id,
    );

    await expect(
      collectBundleGeneratedOutputs(project, store, new Set(["output-inline-tampered"])),
    ).rejects.toThrow(/integrity.*hash/iu);
    await expect(
      collectBundleGeneratedOutputs(project, store, new Set(["output-stored-tampered"])),
    ).rejects.toThrow(/integrity.*hash/iu);
  });

  it("persists generated output bytes and project metadata as one rollback-safe operation", async () => {
    const store = new MemoryProjectStore();
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.metadata.id = "generated-output-project";
    project.generatedOutputs = [];
    const bytes = new Uint8Array([80, 75, 3, 4]);
    project.generatedOutputs.push({
      id: "generated-package",
      kind: "preparation_package",
      title: "Preparation package",
      format: "zip",
      generatedAt: "2026-07-17T12:00:00.000Z",
      sha256: await sha256Hex(bytes),
      validationStatus: "valid",
      validationIssues: [],
    });

    await expect(
      persistProjectWithGeneratedOutputAtomically(store, project, {
        id: "generated-package",
        bytes,
      }),
    ).resolves.toBe(true);
    expect((await store.load(project.metadata.id))?.generatedOutputs[0]?.id).toBe(
      "generated-package",
    );
    expect(await store.getAttachment("generated-package")).toEqual(bytes);
  });

  it("does not persist generated output bytes that fail the project-record hash", async () => {
    const store = new MemoryProjectStore();
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.metadata.id = "generated-output-mismatch";
    project.generatedOutputs = [
      {
        id: "generated-package",
        kind: "preparation_package",
        title: "Preparation package",
        format: "zip",
        generatedAt: "2026-07-17T12:00:00.000Z",
        sha256: await sha256Hex(new Uint8Array([1, 2, 3])),
        validationStatus: "valid",
        validationIssues: [],
      },
    ];

    await expect(
      persistProjectWithGeneratedOutputAtomically(store, project, {
        id: "generated-package",
        bytes: new Uint8Array([9, 9, 9]),
      }),
    ).rejects.toThrow(/integrity.*hash/iu);
    expect(await store.load(project.metadata.id)).toBeUndefined();
    expect(await store.getAttachment("generated-package")).toBeUndefined();
  });

  it("preserves generated-output metadata without claiming byte retention in localStorage", async () => {
    const storage = globalThis.localStorage;
    storage.clear();
    const store: ProjectStore = new LocalStorageProjectStore(storage);
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.metadata.id = "generated-output-fallback";
    project.generatedOutputs = [];
    const bytes = new Uint8Array([80, 75, 3, 4]);
    project.generatedOutputs.push({
      id: "fallback-package",
      kind: "preparation_package",
      title: "Preparation package",
      format: "zip",
      generatedAt: "2026-07-17T12:00:00.000Z",
      sha256: await sha256Hex(bytes),
      validationStatus: "valid",
      validationIssues: [],
    });

    await expect(
      persistProjectWithGeneratedOutputAtomically(store, project, {
        id: "fallback-package",
        bytes,
      }),
    ).resolves.toBe(false);
    expect((await store.load(project.metadata.id))?.generatedOutputs[0]?.id).toBe(
      "fallback-package",
    );
    expect(await store.getAttachment("fallback-package")).toBeUndefined();
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

  it("keeps shared local bytes while another record in the project still references them", async () => {
    const store = new MemoryProjectStore();
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.metadata.id = "shared-attachment-project";
    const bytes = new Uint8Array([7, 7, 7]);
    const hash = await sha256Hex(bytes);
    project.soc2.sourceReport = {
      fileName: "fictional-report.pdf",
      attachmentId: "shared-local-file",
      sha256: hash,
    };
    const evidence = project.evidence[0]!;
    evidence.attachmentId = "shared-local-file";
    evidence.sha256 = hash;
    await store.save(project);
    await store.putAttachment("shared-local-file", bytes, project.metadata.id);

    const next = await removeEvidenceCandidateLocally(store, project, evidence.id);

    expect(next.soc2.sourceReport?.attachmentId).toBe("shared-local-file");
    expect(await store.getAttachment("shared-local-file")).toEqual(bytes);
  });

  it("rejects a metadata-only restore that aliases another project's attachment", async () => {
    const store = new MemoryProjectStore();
    const bytes = new Uint8Array([4, 2, 4, 2]);
    const hash = await sha256Hex(bytes);
    const owner = structuredClone(ACME_METRICS_PROJECT);
    owner.metadata.id = "attachment-owner";
    owner.soc2.sourceReport = {
      fileName: "owner-report.pdf",
      attachmentId: "colliding-local-file",
      sha256: hash,
    };
    await store.save(owner);
    await store.putAttachment("colliding-local-file", bytes, owner.metadata.id);

    const incoming = structuredClone(ACME_METRICS_PROJECT);
    incoming.metadata.id = "attachment-importer";
    incoming.soc2.sourceReport = {
      fileName: "incoming-report.pdf",
      attachmentId: "colliding-local-file",
      sha256: hash,
    };

    await expect(
      restoreImportedProjectAtomically(store, {
        project: incoming,
        manifest: {},
        attachments: new Map(),
        generatedOutputs: new Map(),
      } as unknown as ImportedProjectBundle),
    ).rejects.toThrow(/owned by another local project/iu);
    expect(await store.getAttachment("colliding-local-file")).toEqual(bytes);
    expect(await store.getAttachmentOwner("colliding-local-file")).toEqual({
      kind: "owned",
      projectId: owner.metadata.id,
    });
    expect(await store.load(incoming.metadata.id)).toBeUndefined();
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

    await expect(removeEvidenceCandidateLocally(store, project, evidence.id)).rejects.toThrow(
      /simulated attachment deletion failure/iu,
    );
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

  it("restores imported generated output bytes alongside project metadata", async () => {
    const store = new MemoryProjectStore();
    const incoming = structuredClone(ACME_METRICS_PROJECT);
    incoming.metadata.id = "generated-output-restore";
    incoming.generatedOutputs = [];
    const bytes = new Uint8Array([80, 75, 3, 4]);
    incoming.generatedOutputs.push({
      id: "restored-package",
      kind: "preparation_package",
      title: "Preparation package",
      format: "zip",
      generatedAt: "2026-07-17T12:00:00.000Z",
      sha256: await sha256Hex(bytes),
      validationStatus: "valid",
      validationIssues: [],
    });
    const imported = {
      project: incoming,
      manifest: {},
      attachments: new Map(),
      generatedOutputs: new Map([["restored-package", bytes]]),
    } as unknown as ImportedProjectBundle;

    const restored = await restoreImportedProjectAtomically(store, imported);

    expect(restored.generatedOutputs[0]?.id).toBe("restored-package");
    expect(await store.getAttachment("restored-package")).toEqual(bytes);
  });

  it("rejects a generated output restore that would overwrite unrelated local bytes", async () => {
    const store = new MemoryProjectStore();
    await store.putAttachment("conflicting-output", new Uint8Array([9]), "different-project");
    const incoming = structuredClone(ACME_METRICS_PROJECT);
    incoming.metadata.id = "generated-output-collision";
    incoming.generatedOutputs = [];
    const bytes = new Uint8Array([1]);
    incoming.generatedOutputs.push({
      id: "conflicting-output",
      kind: "preparation_package",
      title: "Preparation package",
      format: "zip",
      generatedAt: "2026-07-17T12:00:00.000Z",
      sha256: await sha256Hex(bytes),
      validationStatus: "valid",
      validationIssues: [],
    });
    const imported = {
      project: incoming,
      manifest: {},
      attachments: new Map(),
      generatedOutputs: new Map([["conflicting-output", bytes]]),
    } as unknown as ImportedProjectBundle;

    await expect(restoreImportedProjectAtomically(store, imported)).rejects.toThrow(
      /owned by another local project/iu,
    );
    expect(await store.getAttachment("conflicting-output")).toEqual(new Uint8Array([9]));
  });

  it("cleans attachment and generated-output bytes no longer referenced after restore", async () => {
    const store = new MemoryProjectStore();
    const current = structuredClone(ACME_METRICS_PROJECT);
    current.metadata.id = "cleanup-restore";
    current.soc2.sourceReport = {
      fileName: "old-report.pdf",
      attachmentId: "stale-report",
      sha256: await sha256Hex(new Uint8Array([1])),
    };
    current.generatedOutputs = [
      {
        id: "stale-output",
        kind: "preparation_package",
        title: "Old package",
        format: "zip",
        generatedAt: "2026-07-17T12:00:00.000Z",
        sha256: await sha256Hex(new Uint8Array([2])),
        validationStatus: "valid",
        validationIssues: [],
      },
    ];
    await store.save(current);
    await store.putAttachment("stale-report", new Uint8Array([1]), current.metadata.id);
    await store.putAttachment("stale-output", new Uint8Array([2]), current.metadata.id);
    const incoming = structuredClone(current);
    delete incoming.soc2.sourceReport;
    incoming.generatedOutputs = [];
    const imported = {
      project: incoming,
      manifest: {},
      attachments: new Map(),
      generatedOutputs: new Map(),
    } as unknown as ImportedProjectBundle;

    await restoreImportedProjectAtomically(store, imported);

    expect(await store.getAttachment("stale-report")).toBeUndefined();
    expect(await store.getAttachment("stale-output")).toBeUndefined();
  });

  it("rolls back project metadata and bytes if stale-output cleanup fails", async () => {
    class FailingCleanupStore extends MemoryProjectStore {
      fail = false;
      override deleteAttachment(id: string): Promise<void> {
        if (this.fail && id === "stale-output") {
          return Promise.reject(new Error("simulated stale output cleanup failure"));
        }
        return super.deleteAttachment(id);
      }
    }
    const store = new FailingCleanupStore();
    const current = structuredClone(ACME_METRICS_PROJECT);
    current.metadata.id = "failed-cleanup-restore";
    current.generatedOutputs = [];
    const bytes = new Uint8Array([2]);
    current.generatedOutputs.push({
      id: "stale-output",
      kind: "preparation_package",
      title: "Old package",
      format: "zip",
      generatedAt: "2026-07-17T12:00:00.000Z",
      sha256: await sha256Hex(bytes),
      validationStatus: "valid",
      validationIssues: [],
    });
    await store.save(current);
    await store.putAttachment("stale-output", bytes, current.metadata.id);
    const incoming = structuredClone(current);
    incoming.metadata.name = "Incoming project";
    incoming.generatedOutputs = [];
    store.fail = true;

    await expect(
      restoreImportedProjectAtomically(store, {
        project: incoming,
        manifest: {},
        attachments: new Map(),
        generatedOutputs: new Map(),
      } as unknown as ImportedProjectBundle),
    ).rejects.toThrow(/simulated stale output cleanup failure/iu);
    expect((await store.load(current.metadata.id))?.metadata.name).toBe(current.metadata.name);
    expect(await store.getAttachment("stale-output")).toEqual(bytes);
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
    const generatedBytes = new Uint8Array([80, 75, 3, 4]);
    incoming.generatedOutputs.push({
      id: "fallback-generated-output",
      kind: "preparation_package",
      title: "Preparation package",
      format: "zip",
      generatedAt: "2026-07-17T12:00:00.000Z",
      sha256: await sha256Hex(generatedBytes),
      validationStatus: "valid",
      validationIssues: [],
    });
    const imported = {
      project: incoming,
      manifest: {},
      attachments: new Map([["fallback-source-report", new Uint8Array([1, 2, 3])]]),
      generatedOutputs: new Map([["fallback-generated-output", generatedBytes]]),
    } as unknown as ImportedProjectBundle;

    const restored = await restoreImportedProjectAtomically(store, imported);

    expect(restored.metadata.id).toBe("fallback-import");
    expect((await store.load("fallback-import"))?.soc2.sourceReport?.attachmentId).toBe(
      "fallback-source-report",
    );
    expect(await store.getAttachment("fallback-source-report")).toBeUndefined();
    expect((await store.load("fallback-import"))?.generatedOutputs).toContainEqual(
      expect.objectContaining({ id: "fallback-generated-output" }),
    );
    expect(await store.getAttachment("fallback-generated-output")).toBeUndefined();
  });
});
