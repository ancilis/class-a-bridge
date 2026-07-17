import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("canonical static deployment", () => {
  it("builds and publishes the combined marketing and application artifact", () => {
    const configUrl = new URL("../../../netlify.toml", import.meta.url);
    expect(existsSync(configUrl), "root netlify.toml is missing").toBe(true);
    if (!existsSync(configUrl)) return;
    const config = readFileSync(configUrl, "utf8");

    expect(config).toContain('command = "pnpm build && pnpm release:assemble"');
    expect(config).toContain('publish = "dist/class-a-bridge"');
  });
});
