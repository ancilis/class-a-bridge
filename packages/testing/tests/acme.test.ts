import { BridgeProjectSchema } from "@class-a-bridge/project";
import { describe, expect, it } from "vitest";

import { ACME_METRICS_PROJECT, SAMPLE_WATERMARK } from "../src/index";

describe("Acme Metrics fictional workspace", () => {
  it("is complete, valid, mixed-state, and unmistakably fictional", () => {
    expect(BridgeProjectSchema.parse(ACME_METRICS_PROJECT)).toEqual(ACME_METRICS_PROJECT);
    expect(ACME_METRICS_PROJECT.metadata.isSample).toBe(true);
    expect(ACME_METRICS_PROJECT.metadata.watermark).toBe(SAMPLE_WATERMARK);
    expect(ACME_METRICS_PROJECT.requirements.length).toBeGreaterThanOrEqual(23);
    expect(
      new Set(ACME_METRICS_PROJECT.requirements.map((item) => item.status)).size,
    ).toBeGreaterThan(2);
    expect(
      ACME_METRICS_PROJECT.requirements.filter(
        (item) => item.ruleId.startsWith("KSI-") && item.implementationNarrative,
      ),
    ).toHaveLength(7);
    expect(ACME_METRICS_PROJECT.evidence.length).toBeGreaterThan(2);
    expect(ACME_METRICS_PROJECT.actions.length).toBeGreaterThan(2);
    expect(ACME_METRICS_PROJECT.advisorFlags.length).toBeGreaterThan(0);
  });
});
