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
});
