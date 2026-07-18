import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Contact handler production configuration", () => {
  it("does not emit JavaScript or declaration source maps", () => {
    const config = JSON.parse(
      readFileSync(new URL("../tsconfig.build.json", import.meta.url), "utf8"),
    ) as { compilerOptions?: { declarationMap?: boolean; sourceMap?: boolean } };

    expect(config.compilerOptions).toMatchObject({
      declarationMap: false,
      sourceMap: false,
    });
  });

  it("has no dependency or source import path to project data packages", () => {
    const packageRecord = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const source = ["../src/index.ts", "../src/worker.ts"]
      .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
      .join("\n");

    expect(packageRecord.dependencies ?? {}).toEqual({});
    expect(source).not.toMatch(/@class-a-bridge\/(?:project|documents|rules|schemas)/u);
    expect(source).not.toMatch(/packages\/(?:project|documents|rules|schemas)/u);
  });
});
