import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  createEmptyProject,
  exportProjectBundle,
  importProjectBundle,
  projectForAdvisor,
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

  it("rejects archive traversal and malformed projects", async () => {
    const traversal = zipSync({ "../project.json": strToU8("{}") });
    await expect(importProjectBundle(traversal)).rejects.toThrow(/unsafe|manifest/iu);
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
