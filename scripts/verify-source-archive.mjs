import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createSourceArchiveBytes, resolveSourceProvenance } from "./assemble-release.mjs";

const execFileAsync = promisify(execFile);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const evidenceDirectory = path.join(root, "dist", "release-evidence");
const evidencePath = path.join(evidenceDirectory, "source-archive-verification.json");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function runVerificationCommand(command, arguments_, cwd, environment = {}) {
  process.stdout.write(`> ${command} ${arguments_.join(" ")}\n`);
  const startedAt = Date.now();
  try {
    const result = await execFileAsync(command, arguments_, {
      cwd,
      env: { ...process.env, ...environment },
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.stdout.write(`Completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.\n`);
    return result;
  } catch (error) {
    if (error && typeof error === "object") {
      if ("stdout" in error && error.stdout) process.stdout.write(error.stdout);
      if ("stderr" in error && error.stderr) process.stderr.write(error.stderr);
    }
    process.stderr.write(
      `Command failed after ${((Date.now() - startedAt) / 1000).toFixed(1)}s.\n`,
    );
    throw error;
  }
}

async function requireFile(filePath) {
  await access(filePath).catch(() => {
    throw new Error(`Expected source-archive verification output is missing: ${filePath}`);
  });
}

async function main() {
  const startedAt = new Date();
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-source-verify-"));
  const archivePath = path.join(temporaryRoot, "class-a-bridge-source.tar.gz");
  const extractedRoot = path.join(temporaryRoot, "source");
  try {
    const provenance = await resolveSourceProvenance({ root });
    const archiveBytes = await createSourceArchiveBytes(root, provenance);
    const archiveSha256 = sha256(archiveBytes);
    await writeFile(archivePath, archiveBytes);
    await mkdir(extractedRoot, { recursive: true });
    await runVerificationCommand("tar", ["-xzf", archivePath, "-C", extractedRoot], root);
    await access(path.join(extractedRoot, ".git")).then(
      () => {
        throw new Error("Source archive unexpectedly contains .git metadata.");
      },
      () => undefined,
    );

    const releaseEnvironment = {
      CI: "1",
      TURBO_FORCE: "true",
      CLASS_A_BRIDGE_SOURCE_COMMIT: provenance.sourceCommit ?? "",
      CLASS_A_BRIDGE_RELEASE_CHANNEL: provenance.releaseChannel,
      CLASS_A_BRIDGE_SOURCE_ARCHIVE_CREATED_AT: provenance.sourceArchiveCreatedAt,
    };
    await runVerificationCommand(
      "pnpm",
      ["install", "--frozen-lockfile"],
      extractedRoot,
      releaseEnvironment,
    );
    await runVerificationCommand("pnpm", ["verify"], extractedRoot, releaseEnvironment);

    const releaseRoot = path.join(extractedRoot, "dist", "class-a-bridge");
    const releaseManifestPath = path.join(releaseRoot, "release-manifest.json");
    await Promise.all([
      requireFile(path.join(releaseRoot, "index.html")),
      requireFile(path.join(releaseRoot, "app", "index.html")),
      requireFile(path.join(releaseRoot, "SOURCE_PROVENANCE.json")),
      requireFile(path.join(releaseRoot, "checksums.txt")),
      requireFile(releaseManifestPath),
    ]);
    const releaseManifest = JSON.parse(await readFile(releaseManifestPath, "utf8"));
    if (releaseManifest.builtFromArchive !== true) {
      throw new Error("Assembled release did not record that it was built from an archive.");
    }
    if (releaseManifest.sourceCommit !== provenance.sourceCommit) {
      throw new Error("Assembled release source commit does not match embedded provenance.");
    }
    const nestedSourceArchivePath = path.join(
      releaseRoot,
      releaseManifest.sourceArchive.replace(/^\//u, ""),
    );
    await requireFile(nestedSourceArchivePath);
    const nestedSourceArchiveSha256 = sha256(await readFile(nestedSourceArchivePath));
    if (nestedSourceArchiveSha256 !== releaseManifest.sourceArchiveSha256) {
      throw new Error("Assembled source archive checksum does not match release-manifest.json.");
    }

    const completedAt = new Date();
    const evidence = {
      status: "Passed",
      verification:
        "Extracted source archive without .git, frozen install, pnpm verify, and output inspection",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationSeconds: Number(((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)),
      toolVersions: provenance.buildToolVersions,
      productVersion: provenance.productVersion,
      releaseChannel: provenance.releaseChannel,
      sourceCommit: provenance.sourceCommit,
      sourceCommitDisplay: provenance.sourceCommitDisplay,
      sourceArchiveSha256: archiveSha256,
      assembledSourceArchiveSha256: nestedSourceArchiveSha256,
      gitMetadataPresent: false,
      extractedSourceGitInitialization: "not performed",
      frozenLockfileInstall: "passed",
      repositoryVerification: "passed",
      releaseAssembly: "passed",
      releaseManifestPath: "dist/class-a-bridge/release-manifest.json",
    };
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    process.stdout.write(`Source archive verification passed. Evidence: ${evidencePath}\n`);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
