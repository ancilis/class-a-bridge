import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  createEmptyProject,
  exportProjectBundle,
  importProjectBundle,
  projectForAdvisor,
  sha256Hex,
} from "../src/index";

describe(".classabridge bundles", () => {
  it("round-trips a standard project with verified hashes", async () => {
    const project = createEmptyProject("Portable", "Acme Metrics");
    project.notes = "private canary";
    const bundle = await exportProjectBundle(project);
    const restored = await importProjectBundle(bundle);
    expect(restored.project).toEqual(project);
    expect(restored.manifest.ruleCatalogVersion).toBe("2026.07.14.01");
  });

  it("round-trips attachment identities instead of archive paths", async () => {
    const project = createEmptyProject("Files", "Acme Metrics");
    const bytes = strToU8("local evidence");
    const bundle = await exportProjectBundle(project, {
      attachments: [{ id: "att-1", fileName: "review.txt", bytes }],
    });
    const restored = await importProjectBundle(bundle);
    expect(restored.attachments.get("att-1")).toEqual(bytes);
  });

  it("migrates supported legacy project data before applying current validation", async () => {
    const projectBytes = strToU8(
      JSON.stringify({
        schemaVersion: 0,
        projectName: "Legacy bundle",
        organizationName: "Old Co",
      }),
    );
    const manifest = {
      format: "class-a-bridge",
      formatVersion: 1,
      createdAt: "2026-07-17T12:00:00.000Z",
      projectId: "legacy-project",
      schemaVersion: 0,
      ruleCatalogVersion: "2025.01.01",
      files: [
        {
          path: "project/project.json",
          sha256: await sha256Hex(projectBytes),
          bytes: projectBytes.byteLength,
          kind: "project",
        },
      ],
      migrationHistory: [],
    };
    const bundle = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "project/project.json": projectBytes,
    });
    const restored = await importProjectBundle(bundle);
    expect(restored.project.metadata.name).toBe("Legacy bundle");
    expect(restored.project.metadata.migrations[0]?.id).toBe("v0-to-v1");
  });

  it("rejects archive traversal and malformed projects", async () => {
    const traversal = zipSync({ "../project.json": strToU8("{}") });
    await expect(importProjectBundle(traversal)).rejects.toThrow(/unsafe|manifest/iu);
  });

  it("rejects a suspicious compression ratio before expansion", async () => {
    const bomb = zipSync({ "manifest.json": strToU8("A".repeat(2 * 1024 * 1024)) }, { level: 9 });
    await expect(importProjectBundle(bomb)).rejects.toThrow(/compression|safe import/iu);
  });

  it("uses an allowlisted advisor projection that excludes sensitive content", () => {
    const project = createEmptyProject("Advisor", "Acme Metrics");
    project.notes = "general counsel note";
    project.soc2.sourceReport = {
      fileName: "secret.pdf",
      attachmentId: "att-1",
      sha256: "a".repeat(64),
    };
    project.evidence.push({
      id: "ev-1",
      title: "Secret screenshot",
      description: "private",
      kind: "screenshot",
      owner: "Security",
      collectedAt: "2026-07-01",
      relatedRequirementIds: [],
      relatedSoc2ControlIds: [],
      sensitivity: "confidential",
      reviewStatus: "candidate",
      sha256: "b".repeat(64),
      attachmentId: "att-2",
      notes: "secret note",
    });
    const redacted = projectForAdvisor(project);
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("secret.pdf");
    expect(serialized).not.toContain("general counsel note");
    expect(serialized).not.toContain("att-2");
    expect(serialized).toContain("Secret screenshot");
  });
});
