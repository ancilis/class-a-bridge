import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, "..");
const execFileAsync = promisify(execFile);

const APP_HEADERS = `
/app/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY

/app/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

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

  const [websiteFiles, bridgeFiles] = await Promise.all([
    countFiles(resolvedWebsite),
    countFiles(resolvedBridge),
  ]);

  await rm(resolvedDestination, { recursive: true, force: true });
  await mkdir(resolvedDestination, { recursive: true });
  await cp(resolvedWebsite, resolvedDestination, { recursive: true });
  await cp(resolvedBridge, path.join(resolvedDestination, "app"), { recursive: true });

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
  const websiteHeaders = await readFile(headersPath, "utf8").catch(() => "");
  await writeFile(headersPath, `${websiteHeaders.trimEnd()}\n${APP_HEADERS.trimStart()}`);
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
