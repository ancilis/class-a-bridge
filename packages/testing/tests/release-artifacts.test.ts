import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { BridgeProjectSchema, importProjectBundle } from "@class-a-bridge/project";
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";

import { SAMPLE_WATERMARK } from "../src/index";
import {
  GENERATED_SAMPLE_ARTIFACTS,
  generateReleaseSampleArtifacts,
} from "../scripts/generate-release-artifacts";

const temporaryDirectories: string[] = [];
const decoder = new TextDecoder();
const execFileAsync = promisify(execFile);

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("fictional release artifacts", () => {
  it("generates a portable project, reuse reports, package, and license bundle with markings", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const outputDirectory = await mkdtemp(path.join(tmpdir(), "class-a-bridge-samples-"));
    temporaryDirectories.push(outputDirectory);

    const result = await generateReleaseSampleArtifacts({
      outputDirectory,
      repositoryRoot: path.resolve(import.meta.dirname, "../../.."),
      generatedAt: "2026-07-18T12:00:00.000Z",
    });

    expect(result.artifacts.map(({ fileName }) => fileName)).toEqual(
      Object.values(GENERATED_SAMPLE_ARTIFACTS),
    );
    expect(result.artifacts.every(({ sha256 }) => /^[a-f0-9]{64}$/u.test(sha256))).toBe(true);

    const projectBundleBytes = new Uint8Array(
      await readFile(path.join(outputDirectory, GENERATED_SAMPLE_ARTIFACTS.project)),
    );
    const projectArchive = unzipSync(projectBundleBytes);
    const projectJson: unknown = JSON.parse(decoder.decode(projectArchive["project/project.json"]));
    const project = BridgeProjectSchema.parse(projectJson);
    expect(project.metadata.watermark).toBe(SAMPLE_WATERMARK);
    expect(project.metadata.isSample).toBe(true);
    const restoredProject = await importProjectBundle(projectBundleBytes);
    expect(restoredProject.project).toEqual(project);
    expect(restoredProject.generatedOutputs.size).toBe(3);

    const reuseHtml = await readFile(
      path.join(outputDirectory, GENERATED_SAMPLE_ARTIFACTS.reuseHtml),
      "utf8",
    );
    const reuseCsv = await readFile(
      path.join(outputDirectory, GENERATED_SAMPLE_ARTIFACTS.reuseCsv),
      "utf8",
    );
    expect(reuseHtml).toContain(SAMPLE_WATERMARK);
    expect(reuseCsv.slice(0, 200)).toContain(SAMPLE_WATERMARK);

    const packageArchive = unzipSync(
      new Uint8Array(
        await readFile(path.join(outputDirectory, GENERATED_SAMPLE_ARTIFACTS.package)),
      ),
    );
    expect(decoder.decode(packageArchive["00-read-me/read-me.html"])).toContain(SAMPLE_WATERMARK);
    expect(decoder.decode(packageArchive["04-soc2-bridge/soc2-to-class-a-mapping.html"])).toContain(
      SAMPLE_WATERMARK,
    );
    const packageManifest: unknown = JSON.parse(decoder.decode(packageArchive["manifest.json"]));
    expect(packageManifest).toEqual(
      expect.objectContaining({ packageVersion: "0.9.0-public-beta-fictional-example" }),
    );

    const licenseArchive = unzipSync(
      new Uint8Array(
        await readFile(path.join(outputDirectory, GENERATED_SAMPLE_ARTIFACTS.licenseBundle)),
      ),
    );
    expect(Object.keys(licenseArchive)).toEqual(["README.txt", "LICENSE", "NOTICE"]);
    expect(decoder.decode(licenseArchive["README.txt"])).toContain(SAMPLE_WATERMARK);
    expect(decoder.decode(licenseArchive.LICENSE)).toContain("Apache License");
    expect(decoder.decode(licenseArchive.NOTICE)).toContain("Class A Bridge");

    const artifactManifest: unknown = JSON.parse(
      await readFile(path.join(outputDirectory, GENERATED_SAMPLE_ARTIFACTS.manifest), "utf8"),
    );
    expect(artifactManifest).toEqual(
      expect.objectContaining({
        watermark: SAMPLE_WATERMARK,
        generatedAt: "2026-07-18T12:00:00.000Z",
        artifacts: expect.any(Array),
      }),
    );
    const manifestArtifacts = (artifactManifest as { artifacts?: unknown }).artifacts;
    expect(Array.isArray(manifestArtifacts)).toBe(true);
    if (!Array.isArray(manifestArtifacts))
      throw new Error("Artifact manifest entries are missing.");
    expect(manifestArtifacts).toHaveLength(5);
    expect(
      manifestArtifacts.every(
        (entry: unknown) =>
          typeof entry === "object" && entry !== null && "sample" in entry && entry.sample === true,
      ),
    ).toBe(true);
  });

  it("runs as the maintainer CLI with the scoped official-validator loader", async () => {
    const { mkdtemp } = await import("node:fs/promises");
    const outputDirectory = await mkdtemp(path.join(tmpdir(), "class-a-bridge-samples-cli-"));
    temporaryDirectories.push(outputDirectory);
    const packageRoot = path.resolve(import.meta.dirname, "..");

    const { stdout } = await execFileAsync(
      path.join(packageRoot, "node_modules/.bin/tsx"),
      [
        "--import",
        path.join(packageRoot, "scripts/register-schema-require.mjs"),
        path.join(packageRoot, "scripts/generate-release-artifacts.ts"),
        outputDirectory,
      ],
      { cwd: packageRoot },
    );

    expect(stdout).toContain("Generated 6 fictional release artifacts");
    expect(
      await readFile(path.join(outputDirectory, GENERATED_SAMPLE_ARTIFACTS.manifest), "utf8"),
    ).toContain(SAMPLE_WATERMARK);
  });
});
