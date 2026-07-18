import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  assembleRelease,
  createSourceArchiveBytes,
  resolveSourceProvenance,
} from "./assemble-release.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("assembles the website and PWA into one static release", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-release-"));
  try {
    const website = path.join(root, "website");
    const bridge = path.join(root, "bridge");
    const destination = path.join(root, "dist", "class-a-bridge");
    await mkdir(website, { recursive: true });
    await mkdir(path.join(bridge, "assets"), { recursive: true });
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "class-a-bridge", version: "1.0.0" }, null, 2)}\n`,
    );
    await writeFile(path.join(website, "index.html"), "marketing");
    await writeFile(
      path.join(website, "_headers"),
      `/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; form-action 'self'; frame-ancestors 'none'
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Permissions-Policy: camera=(), microphone=()
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
`,
    );
    await writeFile(path.join(bridge, "index.html"), "workspace");
    await writeFile(path.join(bridge, "manifest.webmanifest"), "{}");
    await writeFile(path.join(bridge, "sw.js"), "// service worker");
    await writeFile(
      path.join(bridge, "_headers"),
      `/*
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; form-action 'none'; frame-ancestors 'none'
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Permissions-Policy: camera=(), microphone=()
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY

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

    const warnings = [];
    const result = await assembleRelease({
      root,
      website,
      bridge,
      destination,
      environment: {},
      onWarning: (message) => warnings.push(message),
    });

    assert.equal(await readFile(path.join(destination, "index.html"), "utf8"), "marketing");
    assert.equal(await readFile(path.join(destination, "app", "index.html"), "utf8"), "workspace");
    const sourceArchive = await readFile(
      path.join(destination, "downloads", "class-a-bridge-1.0.0-source.tar.gz"),
    );
    assert.deepEqual([...sourceArchive.subarray(0, 3)], [31, 139, 8]);
    const headers = await readFile(path.join(destination, "_headers"), "utf8");
    assert.match(headers, /\/app\/\*/u);
    for (const headerName of [
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Resource-Policy",
      "Permissions-Policy",
      "Referrer-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
    ]) {
      assert.equal(
        headers.match(new RegExp(`^\\s+${headerName}:`, "gmu"))?.length,
        1,
        `${headerName} must be emitted once so static hosts cannot comma-join invalid values`,
      );
    }
    assert.equal(headers.match(/^\s+Content-Security-Policy:/gmu)?.length, 2);
    assert.doesNotMatch(headers, /includeSubDomains|preload/iu);
    const applicationWildcard = headers.match(/\/app\/\*\n([\s\S]*?)\n\/app\//u)?.[1] ?? "";
    assert.match(applicationWildcard, /connect-src 'self'/u);
    assert.doesNotMatch(applicationWildcard, /style-src[^\n]*'unsafe-inline'/u);
    assert.doesNotMatch(applicationWildcard, /form-action 'self'/u);
    assert.match(
      headers,
      /\/app\/index\.html\s+Cache-Control: no-cache, no-store, must-revalidate/u,
    );
    assert.match(headers, /\/app\/sw\.js\s+Cache-Control: no-cache, no-store, must-revalidate/u);
    await assert.rejects(() => readFile(path.join(destination, "app", "_headers"), "utf8"));
    assert.equal(result.destination, destination);
    assert.equal(result.websiteFiles, 2);
    assert.equal(result.bridgeFiles, 5);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /source commit unavailable/iu);
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
          environment: {},
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
          environment: {},
        }),
      /source map/iu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses an overlapping website CSP that would block application resources", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-release-"));
  try {
    const website = path.join(root, "website");
    const bridge = path.join(root, "bridge");
    const destination = path.join(root, "dist", "class-a-bridge");
    await mkdir(website, { recursive: true });
    await mkdir(bridge, { recursive: true });
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "class-a-bridge", version: "1.0.0" }, null, 2)}\n`,
    );
    await writeFile(path.join(website, "index.html"), "marketing");
    await writeFile(
      path.join(website, "_headers"),
      "/*\n  Content-Security-Policy: default-src 'self'; img-src 'self' data:; worker-src 'none'\n",
    );
    await writeFile(path.join(bridge, "index.html"), "workspace");
    await writeFile(path.join(bridge, "manifest.webmanifest"), "{}");
    await writeFile(path.join(bridge, "sw.js"), "// service worker");
    await writeFile(
      path.join(bridge, "_headers"),
      "/*\n  Content-Security-Policy: default-src 'none'; img-src 'self' data: blob:; worker-src 'self' blob:\n",
    );

    await assert.rejects(
      () =>
        assembleRelease({
          root,
          website,
          bridge,
          destination,
          environment: {},
        }),
      /overlapping website content security policy.*img-src.*worker-src/iu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("assembles a real source archive without Git metadata", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-gitless-release-"));
  try {
    const website = path.join(root, "apps", "website", "out");
    const bridge = path.join(root, "apps", "bridge", "dist");
    const destination = path.join(root, "dist", "class-a-bridge");
    await mkdir(website, { recursive: true });
    await mkdir(bridge, { recursive: true });
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "class-a-bridge", version: "0.9.0" }, null, 2)}\n`,
    );
    await writeFile(
      path.join(root, "SOURCE_PROVENANCE.json"),
      `${JSON.stringify(
        {
          productVersion: "0.9.0",
          sourceCommit: "archive-commit-from-embedded-provenance",
          releaseChannel: "public-beta",
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(path.join(root, "README.md"), "# Buildable source archive\n");
    await mkdir(path.join(root, ".pnpm-store"), { recursive: true });
    await writeFile(path.join(root, ".pnpm-store", "cache-entry"), "generated dependency data\n");
    await writeFile(path.join(root, ".env.local"), "DO_NOT_ARCHIVE=secret\n");
    await writeFile(path.join(root, ".env.example"), "DOCUMENTED_SETTING=\n");
    await writeFile(path.join(root, "debug.js.map"), '{"sources":["/local/path"]}\n');
    const longSourcePath = path.join(
      root,
      "docs",
      "source-release-reproducibility-and-provenance",
      "archive-verification-details-for-maintainers-and-release-review.md",
    );
    await mkdir(path.dirname(longSourcePath), { recursive: true });
    await writeFile(longSourcePath, "# Long but valid source path\n");
    await writeFile(path.join(website, "index.html"), "marketing");
    await writeFile(path.join(website, "_headers"), "/*\n  X-Frame-Options: DENY\n");
    await writeFile(path.join(bridge, "index.html"), "workspace");
    await writeFile(path.join(bridge, "manifest.webmanifest"), "{}");
    await writeFile(path.join(bridge, "sw.js"), "// service worker");
    await writeFile(path.join(bridge, "_headers"), "/*\n  X-Frame-Options: DENY\n");

    const result = await assembleRelease({ root, website, bridge, destination, environment: {} });
    const sourceArchive = path.join(destination, "downloads", "class-a-bridge-0.9.0-source.tar.gz");
    const bytes = await readFile(sourceArchive);
    assert.deepEqual([...bytes.subarray(0, 3)], [31, 139, 8]);
    assert.ok(bytes.byteLength > 100, "the source archive must contain real files");
    const { stdout } = await execFileAsync("tar", ["-tzf", sourceArchive]);
    assert.match(stdout, /^package\.json$/mu);
    assert.match(stdout, /^README\.md$/mu);
    assert.match(stdout, /^SOURCE_PROVENANCE\.json$/mu);
    assert.match(stdout, /^\.env\.example$/mu);
    assert.match(
      stdout,
      /^docs\/source-release-reproducibility-and-provenance\/archive-verification-details-for-maintainers-and-release-review\.md$/mu,
    );
    assert.doesNotMatch(stdout, /(?:^|\/)\.pnpm-store(?:\/|$)/mu);
    assert.doesNotMatch(stdout, /^\.env\.local$/mu);
    assert.doesNotMatch(stdout, /\.map$/mu);
    assert.doesNotMatch(stdout, /(?:^|\/)dist(?:\/|$)/mu);
    assert.equal(result.provenance.sourceCommit, "archive-commit-from-embedded-provenance");
    assert.equal(result.provenance.builtFromArchive, true);

    const releaseManifest = JSON.parse(
      await readFile(path.join(destination, "release-manifest.json"), "utf8"),
    );
    assert.equal(releaseManifest.version, "0.9.0");
    assert.equal(releaseManifest.sourceArchive, "/downloads/class-a-bridge-0.9.0-source.tar.gz");
    assert.match(releaseManifest.sourceArchiveSha256, /^[a-f0-9]{64}$/u);
    assert.equal(releaseManifest.sourceCommit, "archive-commit-from-embedded-provenance");
    assert.equal(releaseManifest.builtFromArchive, true);
    const checksums = await readFile(path.join(destination, "checksums.txt"), "utf8");
    assert.match(
      checksums,
      new RegExp(
        `^${releaseManifest.sourceArchiveSha256}  downloads/class-a-bridge-0\\.9\\.0-source\\.tar\\.gz$`,
        "mu",
      ),
    );
    assert.match(checksums, /^[a-f0-9]{64}[ ]{2}release-manifest\.json$/mu);
    assert.match(checksums, /^[a-f0-9]{64}[ ]{2}SOURCE_PROVENANCE\.json$/mu);

    await assert.rejects(
      () =>
        assembleRelease({
          root,
          website,
          bridge,
          destination,
          environment: { CLASS_A_BRIDGE_VERSION: "../../escape" },
        }),
      /safe release version/iu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resolves source commit provenance in the documented fallback order", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-provenance-"));
  try {
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify(
        {
          name: "class-a-bridge",
          version: "0.9.0",
          release: { sourceCommit: "package-commit", channel: "public-beta" },
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(
      path.join(root, "SOURCE_PROVENANCE.json"),
      `${JSON.stringify(
        {
          sourceCommit: "embedded-commit",
          sourceArchiveCreatedAt: "2026-07-18T12:00:00.000Z",
        },
        null,
        2,
      )}\n`,
    );
    const gitMetadata = async () => ({ commit: "git-commit", treeState: "clean" });

    const explicit = await resolveSourceProvenance({
      root,
      environment: {
        CLASS_A_BRIDGE_SOURCE_COMMIT: "environment-commit",
        CLASS_A_BRIDGE_VERSION: "0.9.1",
        CLASS_A_BRIDGE_RELEASE_CHANNEL: "release-candidate",
      },
      gitMetadata,
    });
    assert.equal(explicit.sourceCommit, "environment-commit");
    assert.equal(explicit.sourceCommitOrigin, "environment");
    assert.equal(explicit.productVersion, "0.9.1");
    assert.equal(explicit.releaseChannel, "release-candidate");

    const embedded = await resolveSourceProvenance({ root, environment: {}, gitMetadata });
    assert.equal(embedded.sourceCommit, "embedded-commit");
    assert.equal(embedded.sourceCommitOrigin, "embedded-provenance");
    assert.equal(embedded.sourceArchiveCreatedAt, "2026-07-18T12:00:00.000Z");

    await rm(path.join(root, "SOURCE_PROVENANCE.json"));
    const packageFallback = await resolveSourceProvenance({ root, environment: {}, gitMetadata });
    assert.equal(packageFallback.sourceCommit, "package-commit");
    assert.equal(packageFallback.sourceCommitOrigin, "package-manifest");

    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "class-a-bridge", version: "0.9.0" }, null, 2)}\n`,
    );
    const gitFallback = await resolveSourceProvenance({ root, environment: {}, gitMetadata });
    assert.equal(gitFallback.sourceCommit, "git-commit");
    assert.equal(gitFallback.sourceCommitOrigin, "git");

    const unavailable = await resolveSourceProvenance({
      root,
      environment: {},
      gitMetadata: async () => undefined,
    });
    assert.equal(unavailable.sourceCommit, null);
    assert.equal(unavailable.sourceCommitDisplay, "source commit unavailable");
    assert.equal(unavailable.sourceCommitOrigin, "unavailable");
    assert.equal(unavailable.builtFromArchive, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("records an untracked source file as a dirty Git source tree", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-dirty-provenance-"));
  try {
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "class-a-bridge", version: "0.9.0" }, null, 2)}\n`,
    );
    await execFileAsync("git", ["init", "--quiet"], { cwd: root });
    await execFileAsync("git", ["config", "user.name", "Release Test"], { cwd: root });
    await execFileAsync("git", ["config", "user.email", "release-test@example.invalid"], {
      cwd: root,
    });
    await execFileAsync("git", ["add", "package.json"], { cwd: root });
    await execFileAsync("git", ["commit", "--quiet", "-m", "fixture"], { cwd: root });
    await writeFile(path.join(root, "untracked-release-file.txt"), "must be represented\n");

    const provenance = await resolveSourceProvenance({ root, environment: {} });
    assert.equal(provenance.sourceCommitOrigin, "git");
    assert.equal(provenance.sourceTreeState, "dirty");

    const website = path.join(root, "website");
    const bridge = path.join(root, "bridge");
    await mkdir(website, { recursive: true });
    await mkdir(bridge, { recursive: true });
    await writeFile(path.join(website, "index.html"), "marketing");
    await writeFile(path.join(website, "_headers"), "/*\n  X-Frame-Options: DENY\n");
    await writeFile(path.join(bridge, "index.html"), "workspace");
    await writeFile(path.join(bridge, "manifest.webmanifest"), "{}");
    await writeFile(path.join(bridge, "sw.js"), "// service worker");
    await writeFile(path.join(bridge, "_headers"), "/*\n  X-Frame-Options: DENY\n");
    const warnings = [];
    await assembleRelease({
      root,
      website,
      bridge,
      destination: path.join(root, "dist", "class-a-bridge"),
      environment: {},
      onWarning: (message) => warnings.push(message),
    });
    assert.ok(warnings.some((warning) => /dirty source tree/iu.test(warning)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ignores a parent Git repository for a nested Git-less source archive", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-parent-repository-"));
  try {
    await writeFile(path.join(parent, "tracked.txt"), "parent repository fixture\n");
    await execFileAsync("git", ["init", "--quiet"], { cwd: parent });
    await execFileAsync("git", ["config", "user.name", "Release Test"], { cwd: parent });
    await execFileAsync("git", ["config", "user.email", "release-test@example.invalid"], {
      cwd: parent,
    });
    await execFileAsync("git", ["add", "tracked.txt"], { cwd: parent });
    await execFileAsync("git", ["commit", "--quiet", "-m", "parent fixture"], { cwd: parent });
    const { stdout: parentCommit } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: parent,
    });

    const archiveRoot = path.join(parent, "extracted-source-archive");
    await mkdir(archiveRoot);
    await writeFile(
      path.join(archiveRoot, "package.json"),
      `${JSON.stringify({ name: "class-a-bridge", version: "0.9.0" }, null, 2)}\n`,
    );

    const provenance = await resolveSourceProvenance({ root: archiveRoot, environment: {} });

    assert.notEqual(provenance.sourceCommit, parentCommit.trim());
    assert.equal(provenance.sourceCommit, null);
    assert.equal(provenance.sourceCommitOrigin, "unavailable");
    assert.equal(provenance.sourceTreeState, "archive");
    assert.equal(provenance.builtFromArchive, true);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("keeps tracked source provenance aligned with package and regulatory manifests", async () => {
  const [provenanceText, packageText, rulesText, schemaManifestBytes] = await Promise.all([
    readFile(path.join(repositoryRoot, "SOURCE_PROVENANCE.json"), "utf8"),
    readFile(path.join(repositoryRoot, "package.json"), "utf8"),
    readFile(path.join(repositoryRoot, "packages", "rules", "src", "catalog.ts"), "utf8"),
    readFile(path.join(repositoryRoot, "packages", "schemas", "src", "manifest.ts")),
  ]);
  const provenance = JSON.parse(provenanceText);
  const packageManifest = JSON.parse(packageText);
  const catalogVersion = rulesText.match(/catalogVersion:\s*"([^"]+)"/u)?.[1];
  const rulesChecksum = rulesText.match(/sha256:\s*"([a-f0-9]{64})"/u)?.[1];
  const schemaManifestChecksum = createHash("sha256").update(schemaManifestBytes).digest("hex");

  assert.equal(provenance.productVersion, packageManifest.version);
  assert.equal(provenance.rulesSourceVersion, catalogVersion);
  assert.equal(provenance.rulesChecksum, rulesChecksum);
  assert.equal(provenance.schemaManifestChecksum, schemaManifestChecksum);
  assert.equal(provenance.buildToolVersions.packageManager, packageManifest.packageManager);
  assert.ok(
    provenance.sourceCommit === null ||
      (typeof provenance.sourceCommit === "string" && provenance.sourceCommit.length > 0),
    "tracked provenance may defer the commit; an assembled source archive embeds it",
  );
  assert.equal(provenance.sourceArchiveSha256, null, "assembly computes the archive checksum");
});

test("rejects malformed embedded source provenance instead of silently discarding it", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-invalid-provenance-"));
  try {
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "class-a-bridge", version: "0.9.0" }, null, 2)}\n`,
    );
    await writeFile(path.join(root, "SOURCE_PROVENANCE.json"), "{not-valid-json\n");
    await assert.rejects(
      () =>
        resolveSourceProvenance({
          root,
          environment: {},
          gitMetadata: async () => undefined,
        }),
      /invalid JSON.*SOURCE_PROVENANCE\.json/iu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("creates byte-identical source archives for fixed source bytes and provenance", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-reproducible-archive-"));
  try {
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "class-a-bridge", version: "0.9.0" }, null, 2)}\n`,
    );
    await writeFile(path.join(root, "README.md"), "# Reproducible archive fixture\n");
    const provenance = {
      productVersion: "0.9.0",
      sourceCommit: "fixed-commit",
      sourceArchiveCreatedAt: "2026-07-18T12:00:00.000Z",
      releaseChannel: "public-beta",
    };
    const first = await createSourceArchiveBytes(root, provenance);
    const second = await createSourceArchiveBytes(root, provenance);
    assert.deepEqual(first, second);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects source symlinks that escape the archive root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-source-symlink-"));
  try {
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "class-a-bridge", version: "0.9.0" }, null, 2)}\n`,
    );
    await symlink("../../outside-source-tree", path.join(root, "unsafe-link"));
    await assert.rejects(
      () =>
        createSourceArchiveBytes(root, {
          productVersion: "0.9.0",
          sourceCommit: "fixed-commit",
          sourceArchiveCreatedAt: "2026-07-18T12:00:00.000Z",
          releaseChannel: "public-beta",
        }),
      /symbolic link.*outside the source archive/iu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
