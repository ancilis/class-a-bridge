import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  readlink,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, "..");
const execFileAsync = promisify(execFile);
const SOURCE_ARCHIVE_EXCLUDED_NAMES = new Set([
  ".DS_Store",
  ".git",
  ".next",
  ".pnpm-store",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "playwright-report",
  "test-results",
]);
const SOURCE_ARCHIVE_EXCLUDED_PATTERNS = [
  /^\.env(?:$|\.(?!example$))/u,
  /\.map$/u,
  /\.tsbuildinfo$/u,
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson(filePath) {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}.`, { cause: error });
  }
}

async function readGitMetadata(root) {
  try {
    const { stdout: topLevel } = await execFileAsync("git", [
      "-C",
      root,
      "rev-parse",
      "--show-toplevel",
    ]);
    const [repositoryRoot, intendedRoot] = await Promise.all([
      realpath(path.resolve(topLevel.trim())),
      realpath(path.resolve(root)),
    ]);
    if (repositoryRoot !== intendedRoot) return undefined;

    const [{ stdout: commit }, { stdout: statusOutput }] = await Promise.all([
      execFileAsync("git", ["-C", root, "rev-parse", "HEAD"]),
      execFileAsync("git", ["-C", root, "status", "--porcelain", "--untracked-files=normal"]),
    ]);
    return { commit: commit.trim(), treeState: statusOutput.trim() ? "dirty" : "clean" };
  } catch {
    return undefined;
  }
}

export async function resolveSourceProvenance({
  root = defaultRoot,
  environment = process.env,
  gitMetadata = readGitMetadata,
} = {}) {
  const resolvedRoot = path.resolve(root);
  const [embedded, packageManifest, git] = await Promise.all([
    readJson(path.join(resolvedRoot, "SOURCE_PROVENANCE.json")),
    readJson(path.join(resolvedRoot, "package.json")),
    gitMetadata(resolvedRoot),
  ]);
  const explicitCommit = environment.CLASS_A_BRIDGE_SOURCE_COMMIT?.trim();
  const embeddedCommit =
    typeof embedded?.sourceCommit === "string" && embedded.sourceCommit.trim()
      ? embedded.sourceCommit.trim()
      : undefined;
  const packageCommit =
    typeof packageManifest?.release?.sourceCommit === "string" &&
    packageManifest.release.sourceCommit.trim()
      ? packageManifest.release.sourceCommit.trim()
      : undefined;
  const sourceCommit = explicitCommit || embeddedCommit || packageCommit || git?.commit || null;
  const sourceCommitOrigin = explicitCommit
    ? "environment"
    : embeddedCommit
      ? "embedded-provenance"
      : packageCommit
        ? "package-manifest"
        : git?.commit
          ? "git"
          : "unavailable";

  return {
    productVersion:
      environment.CLASS_A_BRIDGE_VERSION?.trim() ||
      embedded?.productVersion ||
      packageManifest?.version ||
      "version unavailable",
    sourceCommit,
    sourceCommitDisplay: sourceCommit ?? "source commit unavailable",
    sourceCommitOrigin,
    sourceTreeState: git?.treeState ?? "archive",
    builtFromArchive: !git,
    rulesSourceVersion: embedded?.rulesSourceVersion ?? null,
    rulesChecksum: embedded?.rulesChecksum ?? null,
    schemaManifestChecksum: embedded?.schemaManifestChecksum ?? null,
    buildToolVersions: {
      node: process.version,
      packageManager: packageManifest?.packageManager ?? "package manager unavailable",
    },
    sourceArchiveCreatedAt:
      environment.CLASS_A_BRIDGE_SOURCE_ARCHIVE_CREATED_AT?.trim() ||
      embedded?.sourceArchiveCreatedAt ||
      new Date().toISOString(),
    sourceArchiveSha256: null,
    releaseChannel:
      environment.CLASS_A_BRIDGE_RELEASE_CHANNEL?.trim() ||
      embedded?.releaseChannel ||
      packageManifest?.release?.channel ||
      "unspecified",
  };
}

function writeTarString(header, value, offset, length) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error(`Tar field is too long: ${value}`);
  bytes.copy(header, offset);
}

function writeTarOctal(header, value, offset, length) {
  const encoded = Math.max(0, value)
    .toString(8)
    .padStart(length - 1, "0");
  writeTarString(header, `${encoded}\0`, offset, length);
}

function splitTarPath(name) {
  if (Buffer.byteLength(name, "utf8") <= 100) return { name, prefix: "" };
  for (
    let separator = name.lastIndexOf("/");
    separator > 0;
    separator = name.lastIndexOf("/", separator - 1)
  ) {
    const prefix = name.slice(0, separator);
    const basename = name.slice(separator + 1);
    if (Buffer.byteLength(prefix, "utf8") <= 155 && Buffer.byteLength(basename, "utf8") <= 100) {
      return { name: basename, prefix };
    }
  }
  throw new Error(`Tar path cannot be represented safely in ustar format: ${name}`);
}

function createTarHeader({ name, size, mode, type = "0", linkName = "" }) {
  const tarPath = splitTarPath(name);
  const header = Buffer.alloc(512);
  writeTarString(header, tarPath.name, 0, 100);
  writeTarOctal(header, mode, 100, 8);
  writeTarOctal(header, 0, 108, 8);
  writeTarOctal(header, 0, 116, 8);
  writeTarOctal(header, size, 124, 12);
  writeTarOctal(header, 0, 136, 12);
  header.fill(0x20, 148, 156);
  writeTarString(header, type, 156, 1);
  writeTarString(header, linkName, 157, 100);
  writeTarString(header, "ustar\0", 257, 6);
  writeTarString(header, "00", 263, 2);
  writeTarString(header, "root", 265, 32);
  writeTarString(header, "root", 297, 32);
  writeTarString(header, tarPath.prefix, 345, 155);
  const checksum = header.reduce((total, byte) => total + byte, 0);
  writeTarString(header, `${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8);
  return header;
}

function sourceArchivePathIsExcluded(relativePath) {
  const parts = relativePath.split(path.sep);
  return (
    parts.some((part) => SOURCE_ARCHIVE_EXCLUDED_NAMES.has(part)) ||
    parts.some((part) => SOURCE_ARCHIVE_EXCLUDED_PATTERNS.some((pattern) => pattern.test(part)))
  );
}

function compareArchivePaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function safeArchiveLinkName(tarPath, linkName) {
  const normalizedLinkName = linkName.replaceAll("\\", "/");
  const normalizedTarget = path.posix.normalize(
    path.posix.join(path.posix.dirname(tarPath), normalizedLinkName),
  );
  if (
    path.posix.isAbsolute(normalizedLinkName) ||
    /^[A-Za-z]:\//u.test(normalizedLinkName) ||
    normalizedTarget === ".." ||
    normalizedTarget.startsWith("../")
  ) {
    throw new Error(
      `Source symbolic link ${tarPath} points outside the source archive and cannot be published.`,
    );
  }
  return normalizedLinkName;
}

async function collectSourceArchiveEntries(root, directory = root) {
  const entries = [];
  const children = await readdir(directory, { withFileTypes: true });
  children.sort((left, right) => compareArchivePaths(left.name, right.name));
  for (const child of children) {
    const absolutePath = path.join(directory, child.name);
    const relativePath = path.relative(root, absolutePath);
    if (sourceArchivePathIsExcluded(relativePath)) continue;
    if (child.isDirectory())
      entries.push(...(await collectSourceArchiveEntries(root, absolutePath)));
    else if (child.isFile() || child.isSymbolicLink()) entries.push(relativePath);
  }
  return entries;
}

export async function createSourceArchiveBytes(root, provenance) {
  const chunks = [];
  const entries = await collectSourceArchiveEntries(root);
  if (!entries.includes("package.json")) {
    throw new Error("Source archive cannot be created because package.json is missing.");
  }
  if (!entries.includes("SOURCE_PROVENANCE.json")) entries.push("SOURCE_PROVENANCE.json");
  entries.sort(compareArchivePaths);

  for (const relativePath of entries) {
    const tarPath = relativePath.split(path.sep).join("/");
    if (relativePath === "SOURCE_PROVENANCE.json") {
      const bytes = Buffer.from(
        `${JSON.stringify(
          {
            ...provenance,
            sourceArchiveSha256: null,
            sourceArchiveSha256Location: "release-manifest.json and checksums.txt",
          },
          null,
          2,
        )}\n`,
      );
      chunks.push(createTarHeader({ name: tarPath, size: bytes.length, mode: 0o644 }), bytes);
      const padding = (512 - (bytes.length % 512)) % 512;
      if (padding) chunks.push(Buffer.alloc(padding));
      continue;
    }

    const absolutePath = path.join(root, relativePath);
    const info = await lstat(absolutePath);
    if (info.isSymbolicLink()) {
      const linkName = safeArchiveLinkName(tarPath, await readlink(absolutePath));
      chunks.push(createTarHeader({ name: tarPath, size: 0, mode: 0o777, type: "2", linkName }));
      continue;
    }
    const bytes = await readFile(absolutePath);
    const mode = info.mode & 0o111 ? 0o755 : 0o644;
    chunks.push(createTarHeader({ name: tarPath, size: bytes.length, mode }), bytes);
    const padding = (512 - (bytes.length % 512)) % 512;
    if (padding) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks), { level: 9 });
}

function headerNamesForPattern(source, pattern) {
  const names = new Set();
  let activePattern = "";
  for (const line of source.split(/\r?\n/u)) {
    if (line.startsWith("/")) {
      activePattern = line.trim();
      continue;
    }
    if (activePattern !== pattern) continue;
    const match = line.match(/^\s+([^:]+):/u);
    if (match?.[1]) names.add(match[1].toLowerCase());
  }
  return names;
}

function prefixBridgeHeadersForCombinedRelease(bridgeHeaders, websiteHeaders, prefix) {
  const inheritedHeaderNames = headerNamesForPattern(websiteHeaders, "/*");
  let activePattern = "";
  return bridgeHeaders
    .trim()
    .split(/\r?\n/u)
    .filter((line) => {
      if (line.startsWith("/")) {
        activePattern = line.trim();
        return true;
      }
      if (activePattern !== "/*") return true;
      const match = line.match(/^\s+([^:]+):/u);
      const headerName = match?.[1]?.toLowerCase();
      return (
        !headerName ||
        headerName === "content-security-policy" ||
        !inheritedHeaderNames.has(headerName)
      );
    })
    .map((line) => (line.startsWith("/") ? `${prefix}${line}` : line))
    .join("\n");
}

function headerValueForPattern(source, pattern, headerName) {
  let activePattern = "";
  for (const line of source.split(/\r?\n/u)) {
    if (line.startsWith("/")) {
      activePattern = line.trim();
      continue;
    }
    if (activePattern !== pattern) continue;
    const match = line.match(/^\s+([^:]+):\s*(.+)$/u);
    if (match?.[1]?.toLowerCase() === headerName.toLowerCase()) return match[2];
  }
  return undefined;
}

function parseContentSecurityPolicy(value) {
  const directives = new Map();
  for (const segment of value.split(";")) {
    const [name, ...sources] = segment.trim().split(/\s+/u);
    if (name) directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

function assertCompatibleOverlappingCsp(websiteHeaders, bridgeHeaders) {
  const websiteValue = headerValueForPattern(websiteHeaders, "/*", "Content-Security-Policy");
  const bridgeValue = headerValueForPattern(bridgeHeaders, "/*", "Content-Security-Policy");
  if (!websiteValue || !bridgeValue) return;

  const websitePolicy = parseContentSecurityPolicy(websiteValue);
  const bridgePolicy = parseContentSecurityPolicy(bridgeValue);
  const resourceDirectives = [
    "script-src",
    "style-src",
    "img-src",
    "font-src",
    "connect-src",
    "worker-src",
    "manifest-src",
    "media-src",
  ];
  const incompatible = resourceDirectives.filter((directive) => {
    const required = bridgePolicy.get(directive) ?? bridgePolicy.get("default-src") ?? [];
    const allowed = websitePolicy.get(directive) ?? websitePolicy.get("default-src") ?? [];
    return required.some((source) => source !== "'none'" && !allowed.includes(source));
  });
  if (incompatible.length > 0) {
    throw new Error(
      `The overlapping website Content Security Policy would block application resources for: ${incompatible.join(", ")}. Align the website wildcard policy before assembling the combined release.`,
    );
  }
}

async function requireFile(filePath, description) {
  const info = await stat(filePath).catch(() => undefined);
  if (!info?.isFile()) throw new Error(`${description} is missing at ${filePath}. Build first.`);
}

async function countFiles(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) count += await countFiles(path.join(directory, entry.name));
    else if (entry.isFile()) count += 1;
  }
  return count;
}

async function assertNoSourceMaps(directory, description) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await assertNoSourceMaps(entryPath, description);
    else if (entry.isFile() && entry.name.endsWith(".map")) {
      throw new Error(`${description} contains a source map and cannot be published: ${entryPath}`);
    }
  }
}

function assertSafeDestination(root, destination) {
  const distDirectory = path.resolve(root, "dist");
  const resolved = path.resolve(destination);
  const relative = path.relative(distDirectory, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Release destination must be inside the repository dist directory.");
  }
}

function assertSafeReleaseVersion(version) {
  if (
    typeof version !== "string" ||
    version.length > 128 ||
    !/^[0-9A-Za-z][0-9A-Za-z._+-]*$/u.test(version)
  ) {
    throw new Error(
      "A safe release version containing only letters, numbers, dots, underscores, plus signs, or hyphens is required.",
    );
  }
}

export async function assembleRelease({
  root = defaultRoot,
  website = path.join(root, "apps", "website", "out"),
  bridge = path.join(root, "apps", "bridge", "dist"),
  destination = path.join(root, "dist", "class-a-bridge"),
  environment = process.env,
  gitMetadata = readGitMetadata,
  onWarning = (message) => process.stderr.write(`Warning: ${message}\n`),
} = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedWebsite = path.resolve(website);
  const resolvedBridge = path.resolve(bridge);
  const resolvedDestination = path.resolve(destination);
  assertSafeDestination(resolvedRoot, resolvedDestination);

  await requireFile(path.join(resolvedWebsite, "index.html"), "Marketing production build");
  await requireFile(path.join(resolvedBridge, "index.html"), "Bridge production build");
  await requireFile(path.join(resolvedBridge, "manifest.webmanifest"), "PWA manifest");
  await requireFile(path.join(resolvedBridge, "sw.js"), "PWA service worker");
  await requireFile(path.join(resolvedBridge, "_headers"), "Bridge security headers");
  await Promise.all([
    assertNoSourceMaps(resolvedWebsite, "Marketing production build"),
    assertNoSourceMaps(resolvedBridge, "Bridge production build"),
  ]);

  const [websiteFiles, bridgeFiles] = await Promise.all([
    countFiles(resolvedWebsite),
    countFiles(resolvedBridge),
  ]);
  const provenance = await resolveSourceProvenance({
    root: resolvedRoot,
    environment,
    gitMetadata,
  });
  assertSafeReleaseVersion(provenance.productVersion);
  if (provenance.builtFromArchive) {
    const sourceDescription =
      provenance.sourceCommitOrigin === "unavailable"
        ? "source commit unavailable"
        : `source commit resolved from ${provenance.sourceCommitOrigin}`;
    onWarning(
      `Git metadata is unavailable; release assembly is continuing from an extracted source archive (${sourceDescription}).`,
    );
  }
  if (provenance.sourceTreeState === "dirty") {
    onWarning(
      "Release assembly detected a dirty source tree; the archive contains current working-tree bytes that are not fully identified by the recorded commit.",
    );
  }

  await rm(resolvedDestination, { recursive: true, force: true });
  await mkdir(resolvedDestination, { recursive: true });
  await cp(resolvedWebsite, resolvedDestination, { recursive: true });
  await cp(resolvedBridge, path.join(resolvedDestination, "app"), { recursive: true });
  await rm(path.join(resolvedDestination, "app", "_headers"), { force: true });

  const downloadsDirectory = path.join(resolvedDestination, "downloads");
  const sourceArchiveFilename = `class-a-bridge-${provenance.productVersion}-source.tar.gz`;
  const sourceArchivePath = path.join(downloadsDirectory, sourceArchiveFilename);
  await mkdir(downloadsDirectory, { recursive: true });
  await writeFile(sourceArchivePath, await createSourceArchiveBytes(resolvedRoot, provenance));
  const sourceArchiveSha256 = sha256(await readFile(sourceArchivePath));
  const releaseProvenance = { ...provenance, sourceArchiveSha256 };

  const headersPath = path.join(resolvedDestination, "_headers");
  const [websiteHeaders, bridgeHeaders] = await Promise.all([
    readFile(headersPath, "utf8").catch(() => ""),
    readFile(path.join(resolvedBridge, "_headers"), "utf8"),
  ]);
  assertCompatibleOverlappingCsp(websiteHeaders, bridgeHeaders);
  await writeFile(
    headersPath,
    `${websiteHeaders.trimEnd()}\n\n${prefixBridgeHeadersForCombinedRelease(
      bridgeHeaders,
      websiteHeaders,
      "/app",
    )}\n`,
  );
  const releaseManifestPath = path.join(resolvedDestination, "release-manifest.json");
  const sourceProvenancePath = path.join(resolvedDestination, "SOURCE_PROVENANCE.json");
  await writeFile(sourceProvenancePath, `${JSON.stringify(releaseProvenance, null, 2)}\n`);
  await writeFile(
    releaseManifestPath,
    `${JSON.stringify(
      {
        product: "Class A Bridge by Ancilis",
        version: provenance.productVersion,
        websitePath: "/",
        bridgePath: "/app/",
        websiteFiles,
        bridgeFiles,
        sourceArchive: `/downloads/${sourceArchiveFilename}`,
        sourceArchiveSha256,
        sourceCommit: provenance.sourceCommit,
        sourceCommitDisplay: provenance.sourceCommitDisplay,
        sourceCommitOrigin: provenance.sourceCommitOrigin,
        builtFromArchive: provenance.builtFromArchive,
        projectDataTransmission: "none during normal assessment use",
      },
      null,
      2,
    )}\n`,
  );
  const [releaseManifestSha256, sourceProvenanceSha256] = await Promise.all([
    readFile(releaseManifestPath).then(sha256),
    readFile(sourceProvenancePath).then(sha256),
  ]);
  await writeFile(
    path.join(resolvedDestination, "checksums.txt"),
    [
      `${sourceArchiveSha256}  downloads/${sourceArchiveFilename}`,
      `${releaseManifestSha256}  release-manifest.json`,
      `${sourceProvenanceSha256}  SOURCE_PROVENANCE.json`,
      "",
    ].join("\n"),
  );

  return {
    destination: resolvedDestination,
    websiteFiles,
    bridgeFiles,
    provenance: releaseProvenance,
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  assembleRelease()
    .then((result) => {
      process.stdout.write(
        `Release assembled at ${result.destination} (${result.websiteFiles} website files, ${result.bridgeFiles} app files).\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
