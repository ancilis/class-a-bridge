#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  generateReleaseIntegrityReport,
  generateSupplyChainReports,
} from "./release-integrity-runner.mjs";

const OPTION_NAMES = new Map([
  ["--root", "root"],
  ["--report-dir", "reportDir"],
  ["--allowlist", "allowlist"],
  ["--license-input", "licenseInput"],
  ["--audit-input", "auditInput"],
  ["--timestamp", "timestamp"],
]);

export function parseReleaseIntegrityArgs(argv) {
  const command = argv[0] ?? "all";
  if (!new Set(["scan", "supply-chain", "all"]).has(command)) {
    throw new Error("Command must be scan, supply-chain, or all.");
  }
  const result = {
    command,
    root: ".",
    reportDir: "reports/release",
    allowlist: "release-integrity-allowlist.json",
  };
  for (let index = 1; index < argv.length; index += 2) {
    const option = argv[index];
    const property = OPTION_NAMES.get(option);
    if (!property) throw new Error(`Unknown option: ${option}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${option} requires a value.`);
    result[property] = value;
  }
  return result;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function runPnpmJson(rootDir, args, { permitAuditExit = false } = {}) {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath ? process.execPath : "pnpm";
  const commandArgs = npmExecPath ? [npmExecPath, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.error) throw result.error;
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(`pnpm ${args[0]} did not return valid JSON.`);
  }
  if (result.status !== 0 && !permitAuditExit) {
    throw new Error(`pnpm ${args[0]} failed with exit code ${result.status}.`);
  }
  return parsed;
}

function evidenceTimestamp(explicitTimestamp) {
  const timestamp =
    explicitTimestamp ??
    (process.env.SOURCE_DATE_EPOCH
      ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
      : new Date().toISOString());
  if (Number.isNaN(Date.parse(timestamp))) throw new Error("Evidence timestamp must be ISO 8601.");
  return new Date(timestamp).toISOString();
}

async function main() {
  const args = parseReleaseIntegrityArgs(process.argv.slice(2));
  const rootDir = path.resolve(args.root);
  const reportDir = path.resolve(rootDir, args.reportDir);
  let failed = false;

  if (args.command === "supply-chain" || args.command === "all") {
    const licenseInventory = args.licenseInput
      ? await readJson(path.resolve(rootDir, args.licenseInput))
      : runPnpmJson(rootDir, ["licenses", "list", "--prod", "--json"]);
    const auditData = args.auditInput
      ? await readJson(path.resolve(rootDir, args.auditInput))
      : runPnpmJson(rootDir, ["audit", "--prod", "--audit-level=high", "--json"], {
          permitAuditExit: true,
        });
    const rootPackage = await readJson(path.join(rootDir, "package.json"));
    const supplyChain = await generateSupplyChainReports({
      reportDir,
      licenseInventory,
      auditData,
      rootPackage,
      timestamp: evidenceTimestamp(args.timestamp),
    });
    failed ||= supplyChain.status !== "passed";
    process.stdout.write(
      `Supply-chain evidence: ${supplyChain.status}; ${supplyChain.licenseReport.componentCount} production components; ${supplyChain.auditReport.blockingVulnerabilityCount} high-or-critical vulnerabilities.\n`,
    );
  }

  if (args.command === "scan" || args.command === "all") {
    const allowlist = await readJson(path.resolve(rootDir, args.allowlist));
    const integrity = await generateReleaseIntegrityReport({ rootDir, reportDir, allowlist });
    failed ||= integrity.status !== "passed";
    process.stdout.write(
      `Release integrity: ${integrity.status}; ${integrity.scannedFiles} files and ${integrity.scannedArchives} archives scanned; ${integrity.findings.length} active findings.\n`,
    );
  }

  if (failed) process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(
      `Release integrity failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
