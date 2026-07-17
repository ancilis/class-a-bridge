import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PINNED_URL =
  "https://raw.githubusercontent.com/FedRAMP/rules/12fe1b60f578ab448c26d143baac99d16d8bfe14/fedramp-consolidated-rules.json";
const CURRENT_URL =
  process.env.FEDRAMP_RULES_CANDIDATE_URL ??
  "https://raw.githubusercontent.com/FedRAMP/rules/main/fedramp-consolidated-rules.json";
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendorPath = resolve(packageRoot, "vendor/fedramp-consolidated-rules.json");
const approve = process.argv.includes("--approve");

const response = await fetch(CURRENT_URL, {
  headers: { accept: "application/json", "user-agent": "class-a-bridge-rules-compare/1.0" },
});
if (!response.ok) throw new Error(`Unable to retrieve official rules: HTTP ${response.status}`);
const candidateBytes = new Uint8Array(await response.arrayBuffer());
const candidateText = new TextDecoder().decode(candidateBytes);
const candidate = JSON.parse(candidateText) as {
  info?: { last_updated?: string; version?: string };
};
const currentBytes = await readFile(vendorPath);
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const currentHash = hash(currentBytes);
const candidateHash = hash(candidateBytes);

console.log(`Pinned source: ${PINNED_URL}`);
console.log(`Candidate source: ${CURRENT_URL}`);
console.log(`Current SHA-256: ${currentHash}`);
console.log(`Candidate SHA-256: ${candidateHash}`);
console.log(`Candidate version: ${candidate.info?.version ?? "missing"}`);
console.log(`Candidate last updated: ${candidate.info?.last_updated ?? "missing"}`);

if (currentHash === candidateHash) {
  console.log("No official catalog byte changes detected.");
  process.exit(0);
}

const current = JSON.parse(currentBytes.toString("utf8")) as Record<string, unknown>;
const changedTopLevel = [...new Set([...Object.keys(current), ...Object.keys(candidate)])].filter(
  (key) =>
    JSON.stringify(current[key]) !== JSON.stringify((candidate as Record<string, unknown>)[key]),
);
console.log(`Changed top-level sections: ${changedTopLevel.join(", ") || "none"}`);

if (!approve) {
  console.error(
    "Review required. Re-run with --approve only after a maintainer has reviewed official text, applicability, guidance, tests, and version metadata.",
  );
  process.exitCode = 2;
} else {
  await writeFile(vendorPath, candidateBytes);
  console.log(
    "Candidate bytes applied. Update CATALOG_MANIFEST, guidance, reconciliation tests, and release notes before committing.",
  );
}
