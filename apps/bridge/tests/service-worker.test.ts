import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/manifest.webmanifest"), "utf8"),
) as { icons: readonly { src: string; sizes: string; type: string }[] };
const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

describe("service worker release safety", () => {
  it("waits for explicit user consent before activating an installed update", () => {
    const installHandler = source.slice(
      source.indexOf('self.addEventListener("install"'),
      source.indexOf('self.addEventListener("message"'),
    );
    expect(installHandler).not.toMatch(/self\.skipWaiting\(\)/u);
    expect(source).toMatch(/message[\s\S]*SKIP_WAITING[\s\S]*self\.skipWaiting\(\)/u);
  });

  it("deletes only caches owned by Class A Bridge", () => {
    expect(source).toMatch(/startsWith\(CACHE_PREFIX\)/u);
    expect(source).not.toMatch(/filter\(\(key\) => key !== CACHE\)/u);
  });

  it("awaits runtime cache writes before resolving the network response", () => {
    expect(source).toMatch(/await cache\.put\(/u);
  });

  it("matches same-origin precache entries across static-host Vary headers", () => {
    expect(source).toMatch(/cache\.match\(event\.request, \{ ignoreVary: true \}\)/u);
  });

  it("does not activate an update while local changes are saving or failed", () => {
    expect(appSource).toMatch(
      /disabled=\{saveState\.status === "saving" \|\| saveState\.status === "error"\}/u,
    );
    expect(appSource).toMatch(
      /if \(saveState\.status === "saving" \|\| saveState\.status === "error"\) return;[\s\S]*SKIP_WAITING/u,
    );
  });

  it.each([
    { size: 192, fileName: "icon-192.png" },
    { size: 512, fileName: "icon-512.png" },
  ])("ships a real $size by $size PNG install icon", ({ size, fileName }) => {
    expect(manifest.icons).toContainEqual(
      expect.objectContaining({
        src: `./${fileName}`,
        sizes: `${size}x${size}`,
        type: "image/png",
      }),
    );
    const path = resolve(process.cwd(), "public", fileName);
    expect(existsSync(path)).toBe(true);
    const png = readFileSync(path);
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  });

  it("ships static-host security headers with a strict application CSP", () => {
    const headers = readFileSync(resolve(process.cwd(), "public/_headers"), "utf8");
    expect(headers).toMatch(/Content-Security-Policy:.*default-src 'none'/u);
    // The worker may fetch only same-origin static assets. The page's additional meta policy
    // intersects with this header and keeps application fetch/XHR fully disabled.
    expect(headers).toMatch(/connect-src 'self'/u);
    expect(indexHtml).toMatch(/connect-src 'none'/u);
    expect(headers).toMatch(/frame-ancestors 'none'/u);
    expect(headers).toMatch(/Cross-Origin-Opener-Policy: same-origin/u);
    expect(headers).toMatch(/X-Content-Type-Options: nosniff/u);
    expect(headers).toMatch(/\/index\.html\s+Cache-Control: no-cache, no-store, must-revalidate/u);
    expect(headers).toMatch(/\n\/\s+Cache-Control: no-cache, no-store, must-revalidate/u);
  });
});
