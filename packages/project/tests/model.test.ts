import { describe, expect, it } from "vitest";

import { BridgeProjectSchema, createEmptyProject, migrateProject } from "../src/index";

describe("BridgeProject", () => {
  it("creates a strict, versioned local-first project", () => {
    const project = createEmptyProject("Northstar Federal", "Northstar Cloud");
    expect(BridgeProjectSchema.parse(project)).toEqual(project);
    expect(project.metadata).toEqual(
      expect.objectContaining({ schemaVersion: 1, ruleCatalogVersion: "2026.07.14.01" }),
    );
    expect(project.approvals).toEqual([]);
    expect(() => BridgeProjectSchema.parse({ ...project, injected: true })).toThrow();
  });

  it("requires a visible watermark for fictional sample projects", () => {
    const project = createEmptyProject("Sample", "Fictional Co");
    project.metadata.isSample = true;
    expect(() => BridgeProjectSchema.parse(project)).toThrow(/watermark/iu);
    project.metadata.watermark = "Fictional example — not for submission.";
    expect(BridgeProjectSchema.parse(project)).toEqual(project);
  });

  it("migrates legacy projects and records migration history", () => {
    const migrated = migrateProject({
      schemaVersion: 0,
      projectName: "Legacy",
      organizationName: "Old Co",
    });
    expect(migrated.metadata.name).toBe("Legacy");
    expect(migrated.organization.name).toBe("Old Co");
    expect(migrated.metadata.migrations).toEqual([
      expect.objectContaining({ from: 0, to: 1, id: "v0-to-v1" }),
    ]);
    expect(BridgeProjectSchema.parse(migrated)).toEqual(migrated);
  });
});
