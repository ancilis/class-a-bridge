import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildCycloneDxBom,
  buildLicenseReport,
  findingFingerprint,
  scanReleaseTree,
  summarizePnpmAudit,
  validateAllowlist,
} from "./release-integrity-core.mjs";
import {
  generateReleaseIntegrityReport,
  generateSupplyChainReports,
} from "./release-integrity-runner.mjs";
import { parseReleaseIntegrityArgs } from "./release-integrity.mjs";

async function temporaryTree() {
  return mkdtemp(path.join(tmpdir(), "class-a-bridge-integrity-"));
}

function tarHeader(name, size) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(`${size.toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
  header.write("00000000000\0", 136, 12, "ascii");
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  header.write("ustar\0", 257, 6, "ascii");
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return header;
}

function makeTarGzip(name, content) {
  const body = Buffer.from(content);
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512);
  return gzipSync(Buffer.concat([tarHeader(name, body.length), body, padding, Buffer.alloc(1024)]));
}

function makeStoredZip(name, content) {
  const nameBuffer = Buffer.from(name);
  const body = Buffer.from(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(body.length, 22);
  local.writeUInt16LE(nameBuffer.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(body.length, 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt32LE(0, 42);
  const centralOffset = local.length + nameBuffer.length + body.length;
  const centralSize = central.length + nameBuffer.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, nameBuffer, body, central, nameBuffer, end]);
}

test("release scan detects local profiles, the known developer token, source maps, and obvious secrets", async () => {
  const rootDir = await temporaryTree();
  const macProfile = ["", "Users", "release-owner", "project"].join("/");
  const linuxProfile = ["", "home", "builder", "project"].join("/");
  const knownDeveloperToken = ["hello", "hello", "albus"].join("");
  const awsKey = ["AK", "IA", "A".repeat(16)].join("");
  const privateKeyHeader = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  await writeFile(
    path.join(rootDir, "unsafe.txt"),
    [macProfile, linuxProfile, knownDeveloperToken, awsKey, privateKeyHeader].join("\n"),
  );
  await writeFile(path.join(rootDir, ["bundle", "map"].join(".")), "{}\n");

  const result = await scanReleaseTree({ rootDir });

  assert.equal(result.status, "failed");
  assert.deepEqual([...new Set(result.findings.map((finding) => finding.ruleId))].sort(), [
    "secret:aws-access-key-id",
    "secret:private-key",
    "source-map",
    "workstation:developer-username",
    "workstation:linux-profile",
    "workstation:macos-profile",
  ]);
  assert.equal(JSON.stringify(result).includes(rootDir), false);
  assert.ok(result.findings.every((finding) => !Object.hasOwn(finding, "matchedContent")));
});

test("release scan inspects tar.gz and zip archive entries", async () => {
  const rootDir = await temporaryTree();
  await mkdir(path.join(rootDir, "dist"));
  const archiveProfile = ["", "Users", "archive-owner", "release"].join("/");
  await writeFile(
    path.join(rootDir, "dist", "source.tar.gz"),
    makeTarGzip("release/notes.txt", archiveProfile),
  );
  await writeFile(
    path.join(rootDir, "dist", "sample.classabridge"),
    makeStoredZip(["assets", ["app", "map"].join(".")].join("/"), "{}"),
  );

  const result = await scanReleaseTree({ rootDir });

  assert.equal(result.scannedArchives, 2);
  assert.ok(result.findings.some((finding) => finding.ruleId === "workstation:macos-profile"));
  assert.ok(result.findings.some((finding) => finding.ruleId === "source-map"));
  assert.ok(result.findings.every((finding) => finding.relativePath.includes("!")));
});

test("an exact, reviewed allowlist entry suppresses only its fingerprint", async () => {
  const rootDir = await temporaryTree();
  const profile = ["", "home", "fixture-user", "fixture"].join("/");
  await writeFile(path.join(rootDir, "fixture.txt"), `${profile}\n`);
  const ruleId = "workstation:linux-profile";
  const relativePath = "fixture.txt";
  const findingSha256 = findingFingerprint(ruleId, relativePath, profile);
  const allowlist = {
    schemaVersion: 1,
    exceptions: [
      {
        ruleId,
        relativePath,
        findingSha256,
        justification: "Synthetic scanner fixture reviewed for this exact occurrence.",
        reviewer: "Release engineering",
        reviewedOn: "2026-07-18",
        expiresOn: "2027-07-18",
      },
    ],
  };

  const result = await scanReleaseTree({ rootDir, allowlist });

  assert.equal(result.status, "passed");
  assert.equal(result.findings.length, 0);
  assert.equal(result.allowlistedFindings.length, 1);
});

test("allowlist validation rejects broad paths and incomplete review records", () => {
  assert.throws(
    () =>
      validateAllowlist({
        schemaVersion: 1,
        exceptions: [
          {
            ruleId: "source-map",
            relativePath: "**/*.map",
            findingSha256: "0".repeat(64),
            justification: "Broad exception that must never be accepted.",
            reviewer: "",
            reviewedOn: "2026-07-18",
          },
        ],
      }),
    /exact repository-relative path|reviewer/,
  );
});

test("CycloneDX output is deterministic, path-free, and identifies every licensed version", () => {
  const localPath = ["", "home", "builder", "node_modules", "alpha"].join("/");
  const licenseInventory = {
    MIT: [
      {
        name: "alpha",
        versions: ["2.0.0", "1.0.0"],
        paths: [localPath],
        license: "MIT",
        homepage: "https://example.test/alpha",
      },
    ],
    "Apache-2.0 OR MIT": [
      {
        name: "@scope/bravo",
        versions: ["3.0.0"],
        paths: [localPath],
        license: "Apache-2.0 OR MIT",
      },
    ],
  };
  const input = {
    licenseInventory,
    rootPackage: { name: "class-a-bridge", version: "0.9.0", license: "Apache-2.0" },
    timestamp: "2026-07-18T12:00:00.000Z",
  };

  const first = buildCycloneDxBom(input);
  const second = buildCycloneDxBom(input);

  assert.deepEqual(first, second);
  assert.equal(first.bomFormat, "CycloneDX");
  assert.equal(first.specVersion, "1.5");
  assert.deepEqual(
    first.components.map((component) => component["bom-ref"]),
    ["pkg:npm/%40scope/bravo@3.0.0", "pkg:npm/alpha@1.0.0", "pkg:npm/alpha@2.0.0"],
  );
  assert.equal(JSON.stringify(first).includes(localPath), false);
  assert.deepEqual(first.components[0].licenses, [{ expression: "Apache-2.0 OR MIT" }]);
});

test("license report flags unknown licenses as failures and review licenses as unresolved review", () => {
  const report = buildLicenseReport({
    MIT: [{ name: "safe", versions: ["1.0.0"], license: "MIT" }],
    "LGPL-3.0-or-later": [{ name: "review-me", versions: ["2.0.0"], license: "LGPL-3.0-or-later" }],
    UNKNOWN: [{ name: "unknown", versions: ["3.0.0"], license: "UNKNOWN" }],
  });

  assert.equal(report.status, "failed");
  assert.deepEqual(
    report.reviewRequired.map((item) => item.name),
    ["review-me"],
  );
  assert.deepEqual(
    report.blocked.map((item) => item.name),
    ["unknown"],
  );
});

test("pnpm audit summary applies the high severity release threshold", () => {
  const clean = summarizePnpmAudit({
    advisories: {},
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 1, high: 0, critical: 0 },
      dependencies: 88,
      totalDependencies: 88,
    },
  });
  const blocked = summarizePnpmAudit({
    advisories: {
      42: {
        id: 42,
        module_name: "unsafe-package",
        severity: "high",
        title: "Example advisory",
        url: "https://example.test/advisory/42",
        vulnerable_versions: "<2.0.0",
        patched_versions: ">=2.0.0",
      },
    },
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 },
      dependencies: 88,
      totalDependencies: 88,
    },
  });

  assert.equal(clean.status, "passed");
  assert.equal(blocked.status, "failed");
  assert.equal(blocked.releaseThreshold, "high");
  assert.equal(blocked.advisories[0].moduleName, "unsafe-package");
  assert.equal(Object.hasOwn(blocked.advisories[0], "findings"), false);
  assert.throws(
    () => summarizePnpmAudit({ error: { code: "REGISTRY_UNAVAILABLE" } }),
    /did not contain vulnerability metadata/,
  );
});

test("report runner writes path-free integrity, CycloneDX, license, and dependency evidence", async () => {
  const rootDir = await temporaryTree();
  const reportDir = path.join(rootDir, "reports", "release");
  await writeFile(path.join(rootDir, "README.md"), "Release-safe content.\n");
  const licenseInventory = {
    MIT: [{ name: "alpha", versions: ["1.0.0"], license: "MIT" }],
  };
  const auditData = {
    advisories: {},
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
      totalDependencies: 1,
    },
  };

  const integrity = await generateReleaseIntegrityReport({
    rootDir,
    reportDir,
    allowlist: { schemaVersion: 1, exceptions: [] },
  });
  const supplyChain = await generateSupplyChainReports({
    reportDir,
    licenseInventory,
    auditData,
    rootPackage: { name: "class-a-bridge", version: "0.9.0", license: "Apache-2.0" },
    timestamp: "2026-07-18T12:00:00.000Z",
  });

  assert.equal(integrity.status, "passed");
  assert.equal(supplyChain.status, "passed");
  const expectedFiles = [
    "dependency-audit.json",
    "dependency-audit.md",
    "license-summary.json",
    "license-summary.md",
    "release-integrity.json",
    "release-integrity.md",
    "sbom.cdx.json",
  ];
  for (const name of expectedFiles) {
    const contents = await readFile(path.join(reportDir, name), "utf8");
    assert.equal(
      contents.includes(rootDir),
      false,
      `${name} exposed its absolute working directory`,
    );
  }
  const sbom = JSON.parse(await readFile(path.join(reportDir, "sbom.cdx.json"), "utf8"));
  assert.equal(sbom.bomFormat, "CycloneDX");
});

test("release-integrity CLI parser permits explicit, repository-relative evidence inputs", () => {
  assert.deepEqual(
    parseReleaseIntegrityArgs([
      "all",
      "--root",
      ".",
      "--report-dir",
      "reports/release",
      "--allowlist",
      "release-integrity-allowlist.json",
      "--license-input",
      "fixtures/licenses.json",
      "--audit-input",
      "fixtures/audit.json",
      "--timestamp",
      "2026-07-18T12:00:00.000Z",
    ]),
    {
      command: "all",
      root: ".",
      reportDir: "reports/release",
      allowlist: "release-integrity-allowlist.json",
      licenseInput: "fixtures/licenses.json",
      auditInput: "fixtures/audit.json",
      timestamp: "2026-07-18T12:00:00.000Z",
    },
  );
  assert.throws(() => parseReleaseIntegrityArgs(["unknown"]), /scan, supply-chain, or all/);
  assert.throws(() => parseReleaseIntegrityArgs(["scan", "--unexpected"]), /Unknown option/);
});

test("root commands and CI enforce the tested release-integrity gate", async () => {
  const repositoryRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  const workflow = await readFile(
    path.join(repositoryRoot, ".github", "workflows", "ci.yml"),
    "utf8",
  );
  const prettierIgnore = await readFile(path.join(repositoryRoot, ".prettierignore"), "utf8");

  assert.equal(packageJson.scripts["release:scan"], "node scripts/release-integrity.mjs scan");
  assert.equal(
    packageJson.scripts["release:supply-chain"],
    "node scripts/release-integrity.mjs supply-chain",
  );
  assert.equal(packageJson.scripts["release:integrity"], "node scripts/release-integrity.mjs all");
  assert.match(packageJson.scripts["test:release"], /release-integrity\.test\.mjs/u);
  assert.match(workflow, /run: pnpm release:integrity/u);
  assert.match(workflow, /reports\/release\/sbom\.cdx\.json/u);
  assert.match(prettierIgnore, /reports\/release\/sbom\.cdx\.json/u);
  assert.match(prettierIgnore, /reports\/release\/release-integrity\.md/u);
});
