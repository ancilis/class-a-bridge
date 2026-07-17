import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { assembleRelease } from "./assemble-release.mjs";

test("assembles the website and PWA into one static release", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-release-"));
  try {
    const website = path.join(root, "website");
    const bridge = path.join(root, "bridge");
    const destination = path.join(root, "dist", "class-a-bridge");
    await mkdir(website, { recursive: true });
    await mkdir(path.join(bridge, "assets"), { recursive: true });
    await writeFile(path.join(website, "index.html"), "marketing");
    await writeFile(path.join(website, "_headers"), "/*\n  X-Frame-Options: DENY\n");
    await writeFile(path.join(bridge, "index.html"), "workspace");
    await writeFile(path.join(bridge, "manifest.webmanifest"), "{}");
    await writeFile(path.join(bridge, "sw.js"), "// service worker");
    await writeFile(
      path.join(bridge, "_headers"),
      `/*
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'

/
  Cache-Control: no-cache, no-store, must-revalidate

/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/sw.js
  Cache-Control: no-cache, no-store, must-revalidate

/manifest.webmanifest
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`,
    );
    await writeFile(path.join(bridge, "assets", "app.js"), "export {};");

    const result = await assembleRelease({
      root,
      website,
      bridge,
      destination,
      sourceArchiveBytes: new Uint8Array([31, 139, 8, 0]),
    });

    assert.equal(await readFile(path.join(destination, "index.html"), "utf8"), "marketing");
    assert.equal(await readFile(path.join(destination, "app", "index.html"), "utf8"), "workspace");
    assert.deepEqual(
      await readFile(path.join(destination, "downloads", "class-a-bridge-1.0.0-source.tar.gz")),
      Buffer.from([31, 139, 8, 0]),
    );
    const headers = await readFile(path.join(destination, "_headers"), "utf8");
    assert.match(headers, /\/app\/\*/u);
    assert.match(headers, /connect-src 'self'/u);
    assert.doesNotMatch(headers, /style-src[^\n]*'unsafe-inline'/u);
    assert.doesNotMatch(headers, /form-action 'self'/u);
    assert.match(
      headers,
      /\/app\/index\.html\s+Cache-Control: no-cache, no-store, must-revalidate/u,
    );
    assert.match(headers, /\/app\/sw\.js\s+Cache-Control: no-cache, no-store, must-revalidate/u);
    await assert.rejects(() => readFile(path.join(destination, "app", "_headers"), "utf8"));
    assert.equal(result.destination, destination);
    assert.equal(result.websiteFiles, 2);
    assert.equal(result.bridgeFiles, 5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses release destinations outside the repository dist directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-release-"));
  try {
    await assert.rejects(
      () =>
        assembleRelease({
          root,
          website: path.join(root, "website"),
          bridge: path.join(root, "bridge"),
          destination: path.join(root, "elsewhere"),
        }),
      /inside the repository dist directory/iu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses to publish application source maps", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-release-"));
  try {
    const website = path.join(root, "website");
    const bridge = path.join(root, "bridge");
    const destination = path.join(root, "dist", "class-a-bridge");
    await mkdir(website, { recursive: true });
    await mkdir(path.join(bridge, "assets"), { recursive: true });
    await writeFile(path.join(website, "index.html"), "marketing");
    await writeFile(path.join(bridge, "index.html"), "workspace");
    await writeFile(path.join(bridge, "manifest.webmanifest"), "{}");
    await writeFile(path.join(bridge, "sw.js"), "// service worker");
    await writeFile(path.join(bridge, "_headers"), "/*\n  X-Frame-Options: DENY\n");
    await writeFile(path.join(bridge, "assets", "app.js"), "export {};\n");
    await writeFile(path.join(bridge, "assets", "app.js.map"), "{}\n");

    await assert.rejects(
      () =>
        assembleRelease({
          root,
          website,
          bridge,
          destination,
          sourceArchiveBytes: new Uint8Array([31, 139, 8, 0]),
        }),
      /source map/iu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
