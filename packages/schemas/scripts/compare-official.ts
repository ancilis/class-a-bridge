import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { SCHEMA_MANIFEST } from "../src/manifest";

const DEFAULT_INDEX_URL = "https://www.fedramp.gov/schemas/";
const SCHEMA_FILENAME = /fedramp-[a-z0-9-]+-schema-\d{4}-\d{2}-\d{2}\.json/gu;

export function schemaFilesFromIndex(html: string): readonly string[] {
  return [...new Set(html.match(SCHEMA_FILENAME) ?? [])].sort();
}

export function compareSchemaFiles(
  pinned: ReadonlyMap<string, string>,
  candidate: ReadonlyMap<string, string>,
) {
  return {
    added: [...candidate.keys()].filter((file) => !pinned.has(file)).sort(),
    removed: [...pinned.keys()].filter((file) => !candidate.has(file)).sort(),
    changed: [...candidate.keys()]
      .filter((file) => pinned.has(file) && pinned.get(file) !== candidate.get(file))
      .sort(),
  };
}

async function run() {
  const indexUrl = process.env.FEDRAMP_SCHEMAS_INDEX_URL ?? DEFAULT_INDEX_URL;
  const indexResponse = await fetch(indexUrl, {
    headers: { accept: "text/html", "user-agent": "class-a-bridge-schemas-compare/1.0" },
  });
  if (!indexResponse.ok) {
    throw new Error(`Unable to retrieve official schema index: HTTP ${indexResponse.status}`);
  }
  const files = schemaFilesFromIndex(await indexResponse.text());
  if (files.length === 0) throw new Error("Official schema index contained no dated JSON schemas.");

  const candidate = new Map<string, string>();
  for (const file of files) {
    const response = await fetch(new URL(file, indexUrl), {
      headers: { accept: "application/schema+json, application/json" },
    });
    if (!response.ok) throw new Error(`Unable to retrieve ${file}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    candidate.set(file, createHash("sha256").update(bytes).digest("hex"));
  }

  const pinned = new Map(SCHEMA_MANIFEST.map((entry) => [entry.file, entry.sha256]));
  const diff = compareSchemaFiles(pinned, candidate);
  process.stdout.write(`Official index: ${indexUrl}\n`);
  process.stdout.write(`Pinned schemas: ${pinned.size}\n`);
  process.stdout.write(`Official schemas discovered: ${candidate.size}\n`);
  process.stdout.write(`Added: ${diff.added.join(", ") || "none"}\n`);
  process.stdout.write(`Removed: ${diff.removed.join(", ") || "none"}\n`);
  process.stdout.write(`Byte changed: ${diff.changed.join(", ") || "none"}\n`);

  if (diff.added.length || diff.removed.length || diff.changed.length) {
    process.stderr.write(
      "Review required. No files were changed. A maintainer must review official schema text, references, generator aliases, validation UX, checksums, tests, and release notes before approving product changes.\n",
    );
    process.exitCode = 2;
  } else {
    process.stdout.write("No official schema filename or byte changes detected.\n");
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
