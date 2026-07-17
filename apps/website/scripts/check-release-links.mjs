import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultReleaseRoot = fileURLToPath(new URL("../../../dist/class-a-bridge/", import.meta.url));

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(entryPath)));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(entryPath);
  }
  return files;
}

function internalLinks(markup) {
  return [...markup.matchAll(/\shref=["'](\/[^"']*)["']/giu)].map((match) => match[1]);
}

function targetFor(href) {
  const { pathname } = new URL(href, "https://class-a-bridge.invalid");
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  return !relative || pathname.endsWith("/") ? path.join(relative, "index.html") : relative;
}

export async function checkReleaseLinks(releaseRoot) {
  const missing = new Set();
  for (const htmlPath of await htmlFiles(releaseRoot)) {
    const markup = await readFile(htmlPath, "utf8");
    for (const href of internalLinks(markup)) {
      const target = targetFor(href);
      try {
        await access(path.join(releaseRoot, target));
      } catch {
        missing.add(`${href} -> ${target}`);
      }
    }
  }
  return [...missing].sort();
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const releaseRoot = path.resolve(process.argv[2] ?? defaultReleaseRoot);
  checkReleaseLinks(releaseRoot)
    .then((missing) => {
      if (missing.length > 0) {
        process.stderr.write(
          `Broken release links:\n${missing.map((item) => `- ${item}`).join("\n")}\n`,
        );
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`All internal release links resolve in ${releaseRoot}.\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
