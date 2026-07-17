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
    await writeFile(path.join(bridge, "assets", "app.js"), "export {};");

    const result = await assembleRelease({ root, website, bridge, destination });

    assert.equal(await readFile(path.join(destination, "index.html"), "utf8"), "marketing");
    assert.equal(await readFile(path.join(destination, "app", "index.html"), "utf8"), "workspace");
    assert.match(await readFile(path.join(destination, "_headers"), "utf8"), /\/app\/\*/u);
    assert.match(await readFile(path.join(destination, "_headers"), "utf8"), /connect-src 'none'/u);
    assert.equal(result.destination, destination);
    assert.equal(result.websiteFiles, 2);
    assert.equal(result.bridgeFiles, 4);
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
