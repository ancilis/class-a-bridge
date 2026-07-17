import { z } from "zod";

import { BridgeProjectSchema, createEmptyProject, type BridgeProject } from "./model";

const LegacyProjectSchema = z
  .object({ schemaVersion: z.literal(0), projectName: z.string(), organizationName: z.string() })
  .strict();

export function migrateProject(input: unknown): BridgeProject {
  const current = BridgeProjectSchema.safeParse(input);
  if (current.success) return current.data;
  const legacy = LegacyProjectSchema.parse(input);
  const project = createEmptyProject(legacy.projectName, legacy.organizationName);
  project.metadata.migrations.push({
    id: "v0-to-v1",
    from: 0,
    to: 1,
    appliedAt: new Date().toISOString(),
  });
  return BridgeProjectSchema.parse(project);
}
