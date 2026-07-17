import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

// @ts-expect-error The release checker is an executable JavaScript module exercised by this test.
import * as releaseLinkModule from "../scripts/check-release-links.mjs";

const { checkReleaseLinks } = releaseLinkModule as unknown as {
  readonly checkReleaseLinks: (releaseRoot: string) => Promise<readonly string[]>;
};

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function releaseFixture(includeApplication: boolean): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "class-a-bridge-links-"));
  temporaryDirectories.push(root);
  await writeFile(
    path.join(root, "index.html"),
    '<a href="/launch/">Launch</a><a href="/app/?start=sample">Sample</a>',
  );
  await mkdir(path.join(root, "launch"), { recursive: true });
  await writeFile(path.join(root, "launch", "index.html"), "Launch page");
  if (includeApplication) {
    await mkdir(path.join(root, "app"), { recursive: true });
    await writeFile(path.join(root, "app", "index.html"), "Application");
  }
  return root;
}

describe("assembled release links", () => {
  it("accepts query-string launch links when the application route exists", async () => {
    const root = await releaseFixture(true);
    await expect(checkReleaseLinks(root)).resolves.toEqual([]);
  });

  it("reports a missing application route instead of skipping it", async () => {
    const root = await releaseFixture(false);
    await expect(checkReleaseLinks(root)).resolves.toEqual([
      "/app/?start=sample -> app/index.html",
    ]);
  });
});
