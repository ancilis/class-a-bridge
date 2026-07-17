import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, "..");
const execFileAsync = promisify(execFile);

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

export async function assembleRelease({
  root = defaultRoot,
  website = path.join(root, "apps", "website", "out"),
  bridge = path.join(root, "apps", "bridge", "dist"),
  destination = path.join(root, "dist", "class-a-bridge"),
  sourceArchiveBytes,
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

  await rm(resolvedDestination, { recursive: true, force: true });
  await mkdir(resolvedDestination, { recursive: true });
  await cp(resolvedWebsite, resolvedDestination, { recursive: true });
  await cp(resolvedBridge, path.join(resolvedDestination, "app"), { recursive: true });
  await rm(path.join(resolvedDestination, "app", "_headers"), { force: true });

  const downloadsDirectory = path.join(resolvedDestination, "downloads");
  const sourceArchivePath = path.join(downloadsDirectory, "class-a-bridge-1.0.0-source.tar.gz");
  await mkdir(downloadsDirectory, { recursive: true });
  if (sourceArchiveBytes) {
    await writeFile(sourceArchivePath, sourceArchiveBytes);
  } else {
    await execFileAsync("git", [
      "-C",
      resolvedRoot,
      "archive",
      "--format=tar.gz",
      `--output=${sourceArchivePath}`,
      "HEAD",
    ]);
  }

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
  await writeFile(
    path.join(resolvedDestination, "release-manifest.json"),
    `${JSON.stringify(
      {
        product: "Class A Bridge by Ancilis",
        version: "1.0.0",
        websitePath: "/",
        bridgePath: "/app/",
        websiteFiles,
        bridgeFiles,
        sourceArchive: "/downloads/class-a-bridge-1.0.0-source.tar.gz",
        projectDataTransmission: "none during normal assessment use",
      },
      null,
      2,
    )}\n`,
  );

  return { destination: resolvedDestination, websiteFiles, bridgeFiles };
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
