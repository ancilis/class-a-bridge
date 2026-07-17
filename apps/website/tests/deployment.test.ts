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

  it("checks in a safe one-year HSTS policy for the assembled website and application", () => {
    const websiteHeaders = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
    const bridgeHeaders = readFileSync(
      new URL("../../bridge/public/_headers", import.meta.url),
      "utf8",
    );

    for (const headers of [websiteHeaders, bridgeHeaders]) {
      expect(headers).toContain("Strict-Transport-Security: max-age=31536000");
      expect(headers).not.toMatch(/includeSubDomains|preload/iu);
    }
  });

  it("keeps the wildcard website CSP compatible with the nested PWA policy", () => {
    const websiteHeaders = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");

    expect(websiteHeaders).toMatch(/img-src 'self' data: blob:/u);
    expect(websiteHeaders).toMatch(/worker-src 'self' blob:/u);
    expect(websiteHeaders).not.toMatch(/worker-src 'none'/u);
    expect(websiteHeaders).toContain("Referrer-Policy: no-referrer");
  });
});
