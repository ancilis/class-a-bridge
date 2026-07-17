import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CACHE_VERSION_MARKER = '"__CLASS_A_BRIDGE_CACHE_VERSION__"';
const PRECACHE_MARKER = '["__CLASS_A_BRIDGE_PRECACHE__"]';
const BUILD_ONLY_FILES = new Set(["_headers", "sw.js"]);

export interface PrecacheFile {
  readonly relativePath: string;
  readonly bytes: Uint8Array;
}

export interface PrecachePlan {
  readonly cacheVersion: string;
  readonly urls: readonly string[];
}

function toPortablePath(value: string) {
  return value.split(sep).join("/");
}

function isRuntimeFile(relativePath: string) {
  return !BUILD_ONLY_FILES.has(relativePath) && !relativePath.endsWith(".map");
}

export function createPrecachePlan(files: readonly PrecacheFile[]): PrecachePlan {
  const runtimeFiles = files
    .filter(({ relativePath }) => isRuntimeFile(relativePath))
    .toSorted((left, right) => left.relativePath.localeCompare(right.relativePath));
  const runtimePaths = new Set(runtimeFiles.map(({ relativePath }) => relativePath));

  if (!runtimePaths.has("index.html"))
    throw new Error("The production build is missing required file index.html.");
  if (!runtimeFiles.some(({ relativePath }) => relativePath.endsWith(".js")))
    throw new Error("The production build does not contain a JavaScript application asset.");
  if (!runtimeFiles.some(({ relativePath }) => relativePath.endsWith(".css")))
    throw new Error("The production build does not contain a CSS application asset.");

  const hash = createHash("sha256");
  for (const file of runtimeFiles) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.bytes);
    hash.update("\0");
  }

  return {
    cacheVersion: `release-${hash.digest("hex").slice(0, 16)}`,
    urls: runtimeFiles.map(({ relativePath }) => `./${relativePath}`),
  };
}

export function renderServiceWorker(template: string, plan: PrecachePlan): string {
  if (!template.includes(CACHE_VERSION_MARKER) || !template.includes(PRECACHE_MARKER))
    throw new Error("The service worker template is missing a required build marker.");

  return template
    .replace(CACHE_VERSION_MARKER, JSON.stringify(plan.cacheVersion))
    .replace(PRECACHE_MARKER, JSON.stringify(plan.urls, null, 2));
}

async function collectFiles(directory: string, root = directory): Promise<PrecacheFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: PrecacheFile[] = [];
  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(absolutePath, root)));
    else if (entry.isFile())
      files.push({
        relativePath: toPortablePath(relative(root, absolutePath)),
        bytes: await readFile(absolutePath),
      });
  }
  return files;
}

export async function buildServiceWorker(options: {
  readonly distDirectory: string;
  readonly templatePath: string;
}): Promise<PrecachePlan> {
  const files = await collectFiles(options.distDirectory);
  const plan = createPrecachePlan(files);
  const template = await readFile(options.templatePath, "utf8");
  const output = renderServiceWorker(template, plan);
  await writeFile(join(options.distDirectory, "sw.js"), output, "utf8");
  return plan;
}

const scriptPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
  const bridgeDirectory = resolve(dirname(scriptPath), "..");
  const plan = await buildServiceWorker({
    distDirectory: join(bridgeDirectory, "dist"),
    templatePath: join(bridgeDirectory, "public", "sw.js"),
  });
  process.stdout.write(
    `Generated service worker ${plan.cacheVersion} with ${String(plan.urls.length)} precached files.\n`,
  );
}
