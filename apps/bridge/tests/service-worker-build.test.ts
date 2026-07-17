import { describe, expect, it } from "vitest";

import { createPrecachePlan, renderServiceWorker } from "../scripts/build-service-worker.ts";

const bytes = (value: string) => new TextEncoder().encode(value);

describe("production service worker generation", () => {
  it("precaches every runtime file while excluding build-only artifacts", () => {
    const plan = createPrecachePlan([
      { relativePath: "sw.js", bytes: bytes("template") },
      { relativePath: "_headers", bytes: bytes("headers") },
      { relativePath: "assets/index-abc123.js.map", bytes: bytes("map") },
      { relativePath: "assets/index-abc123.js", bytes: bytes("javascript") },
      { relativePath: "assets/index-def456.css", bytes: bytes("css") },
      { relativePath: "assets/pdf.worker-ghi789.mjs", bytes: bytes("worker") },
      { relativePath: "index.html", bytes: bytes("html") },
      { relativePath: "manifest.webmanifest", bytes: bytes("manifest") },
    ]);

    expect(plan.urls).toEqual([
      "./assets/index-abc123.js",
      "./assets/index-def456.css",
      "./assets/pdf.worker-ghi789.mjs",
      "./index.html",
      "./manifest.webmanifest",
    ]);
    expect(plan.cacheVersion).toMatch(/^release-[a-f0-9]{16}$/u);
  });

  it("changes the cache version when a stable-name asset changes", () => {
    const first = createPrecachePlan([
      { relativePath: "assets/index-abc123.js", bytes: bytes("javascript") },
      { relativePath: "assets/index-def456.css", bytes: bytes("css") },
      { relativePath: "index.html", bytes: bytes("first") },
    ]);
    const second = createPrecachePlan([
      { relativePath: "assets/index-abc123.js", bytes: bytes("javascript") },
      { relativePath: "assets/index-def456.css", bytes: bytes("css") },
      { relativePath: "index.html", bytes: bytes("second") },
    ]);

    expect(second.cacheVersion).not.toBe(first.cacheVersion);
  });

  it("renders a complete worker without leaving build markers", () => {
    const rendered = renderServiceWorker(
      'const CACHE_VERSION = "__CLASS_A_BRIDGE_CACHE_VERSION__";\n' +
        'const PRECACHE = ["__CLASS_A_BRIDGE_PRECACHE__"];\n',
      {
        cacheVersion: "release-0123456789abcdef",
        urls: ["./assets/index-abc123.js", "./index.html"],
      },
    );

    expect(rendered).toContain('const CACHE_VERSION = "release-0123456789abcdef";');
    expect(rendered).toContain('"./assets/index-abc123.js"');
    expect(rendered).toContain('"./index.html"');
    expect(rendered).not.toContain("__CLASS_A_BRIDGE_");
  });
});
