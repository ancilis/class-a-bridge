import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync, inflateRawSync } from "node:zlib";

const MAX_FILE_BYTES = 128 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_ARCHIVE_ENTRY_BYTES = 128 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 100_000;
const MAX_COMPRESSION_RATIO = 1_000;

const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".cache",
  ".pnpm-store",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);

// This digest identifies a known development-machine username without publishing it.
const FORBIDDEN_DEVELOPER_TOKEN_SHA256 =
  "b77d093d0a1581b268e72b0ed0ae6b345881e9c2605323e8d7b60cb021d0f686";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeRelativePath(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function containsGlob(value) {
  return /[*?[\]{}]/u.test(value);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function validateAllowlist(allowlist, now = new Date()) {
  if (!allowlist || allowlist.schemaVersion !== 1 || !Array.isArray(allowlist.exceptions)) {
    throw new Error(
      "Release-integrity allowlist must use schemaVersion 1 and an exceptions array.",
    );
  }

  const keys = new Set();
  for (const [index, exception] of allowlist.exceptions.entries()) {
    const prefix = `Allowlist exception ${index + 1}`;
    if (typeof exception.ruleId !== "string" || exception.ruleId.length < 3) {
      throw new Error(`${prefix} must name one exact ruleId.`);
    }
    if (
      typeof exception.relativePath !== "string" ||
      exception.relativePath.length === 0 ||
      path.isAbsolute(exception.relativePath) ||
      containsGlob(exception.relativePath) ||
      exception.relativePath.split(/[\\/]/u).includes("..")
    ) {
      throw new Error(
        `${prefix} must use one exact repository-relative path without traversal or globs.`,
      );
    }
    if (!/^[a-f0-9]{64}$/u.test(exception.findingSha256 ?? "")) {
      throw new Error(`${prefix} must include the exact 64-character findingSha256.`);
    }
    if (typeof exception.justification !== "string" || exception.justification.trim().length < 20) {
      throw new Error(`${prefix} must include a substantive justification.`);
    }
    if (typeof exception.reviewer !== "string" || exception.reviewer.trim().length < 3) {
      throw new Error(`${prefix} must include a reviewer.`);
    }
    if (!isIsoDate(exception.reviewedOn)) {
      throw new Error(`${prefix} must include reviewedOn as YYYY-MM-DD.`);
    }
    if (exception.expiresOn !== undefined) {
      if (!isIsoDate(exception.expiresOn)) {
        throw new Error(`${prefix} expiresOn must be YYYY-MM-DD when supplied.`);
      }
      const endOfExpiryDay = Date.parse(`${exception.expiresOn}T23:59:59.999Z`);
      if (endOfExpiryDay < now.getTime()) {
        throw new Error(`${prefix} expired on ${exception.expiresOn}.`);
      }
    }

    const key = `${exception.ruleId}\0${normalizeRelativePath(exception.relativePath)}\0${exception.findingSha256}`;
    if (keys.has(key)) throw new Error(`${prefix} duplicates another exception.`);
    keys.add(key);
  }
  return allowlist;
}

export function findingFingerprint(ruleId, relativePath, matchedValue) {
  return sha256(`${ruleId}\0${normalizeRelativePath(relativePath)}\0${matchedValue}`);
}

function lineForOffset(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function createFinding(ruleId, relativePath, matchedValue, line) {
  const finding = {
    ruleId,
    relativePath: normalizeRelativePath(relativePath),
    findingSha256: findingFingerprint(ruleId, relativePath, matchedValue),
  };
  if (line !== undefined) finding.line = line;
  return finding;
}

function contentFindings(buffer, relativePath) {
  const text = buffer.toString("utf8");
  const findings = [];
  const patternRules = [
    {
      ruleId: "workstation:macos-profile",
      pattern: /\/Users\/[A-Za-z0-9._-]+(?:\/[^\s"'<>]+)*/gu,
    },
    {
      ruleId: "workstation:linux-profile",
      pattern: /\/home\/[A-Za-z0-9._-]+(?:\/[^\s"'<>]+)*/gu,
    },
    {
      ruleId: "workstation:windows-profile",
      pattern: /\b[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9._-]+(?:[\\/][^\s"'<>]+)*/gu,
    },
    { ruleId: "secret:aws-access-key-id", pattern: /\bAKIA[0-9A-Z]{16}\b/gu },
    {
      ruleId: "secret:private-key",
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu,
    },
    { ruleId: "secret:github-token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/gu },
    { ruleId: "secret:npm-token", pattern: /\bnpm_[A-Za-z0-9]{20,}\b/gu },
  ];

  for (const { ruleId, pattern } of patternRules) {
    for (const match of text.matchAll(pattern)) {
      findings.push(
        createFinding(ruleId, relativePath, match[0], lineForOffset(text, match.index)),
      );
    }
  }

  const tokenPattern = /[A-Za-z0-9._-]{4,}/gu;
  for (const match of text.matchAll(tokenPattern)) {
    if (sha256(match[0]) === FORBIDDEN_DEVELOPER_TOKEN_SHA256) {
      findings.push(
        createFinding(
          "workstation:developer-username",
          relativePath,
          match[0],
          lineForOffset(text, match.index),
        ),
      );
    }
  }
  return findings;
}

function sourceMapFinding(relativePath) {
  return createFinding("source-map", relativePath, normalizeRelativePath(relativePath));
}

function unsafeArchiveEntry(name) {
  const normalized = name.replaceAll("\\", "/");
  return (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized.split("/").includes("..")
  );
}

function archiveEntryPath(archivePath, entryName) {
  if (unsafeArchiveEntry(entryName)) {
    return `${normalizeRelativePath(archivePath)}!<unsafe-entry-${sha256(entryName).slice(0, 12)}>`;
  }
  return `${normalizeRelativePath(archivePath)}!${entryName.replaceAll("\\", "/").replace(/^\.\//, "")}`;
}

function parseOctal(buffer, start, length) {
  const value = buffer
    .subarray(start, start + length)
    .toString("ascii")
    .replaceAll("\0", "")
    .trim();
  return value.length === 0 ? 0 : Number.parseInt(value, 8);
}

function parseTar(buffer) {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/su, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/su, "");
    const entryName = prefix ? `${prefix}/${name}` : name;
    const size = parseOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const dataOffset = offset + 512;
    const dataEnd = dataOffset + size;
    if (!Number.isSafeInteger(size) || size < 0 || dataEnd > buffer.length) {
      throw new Error("Malformed tar entry size.");
    }
    if ((type === "0" || type === "\0") && entryName) {
      entries.push({ name: entryName, data: buffer.subarray(dataOffset, dataEnd), size });
    }
    if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error("Archive entry limit exceeded.");
    offset = dataOffset + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function findZipEnd(buffer) {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP end-of-central-directory record was not found.");
}

function parseZip(buffer) {
  const endOffset = findZipEnd(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (entryCount > MAX_ARCHIVE_ENTRIES || centralOffset + centralSize > buffer.length) {
    throw new Error("ZIP central directory exceeds safety limits.");
  }

  const entries = [];
  let offset = centralOffset;
  let totalExpanded = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Malformed ZIP central directory.");
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const expandedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if ((flags & 1) !== 0) throw new Error("Encrypted ZIP entries cannot be release-scanned.");
    if (expandedSize > MAX_ARCHIVE_ENTRY_BYTES) throw new Error("ZIP entry size limit exceeded.");
    if (compressedSize > 0 && expandedSize / compressedSize > MAX_COMPRESSION_RATIO) {
      throw new Error("ZIP compression ratio limit exceeded.");
    }
    totalExpanded += expandedSize;
    if (totalExpanded > MAX_ARCHIVE_BYTES) throw new Error("ZIP expanded-size limit exceeded.");
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error("Malformed ZIP local header.");
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressedEnd = dataOffset + compressedSize;
    if (compressedEnd > buffer.length) throw new Error("ZIP entry data exceeds archive bounds.");
    const compressed = buffer.subarray(dataOffset, compressedEnd);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8)
      data = inflateRawSync(compressed, { maxOutputLength: MAX_ARCHIVE_ENTRY_BYTES });
    else throw new Error(`Unsupported ZIP compression method ${method}.`);
    if (data.length !== expandedSize)
      throw new Error("ZIP expanded size does not match its directory.");
    if (!name.endsWith("/")) entries.push({ name, data, size: expandedSize });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function archiveKind(relativePath) {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tar-gzip";
  if (lower.endsWith(".zip") || lower.endsWith(".classabridge")) return "zip";
  return null;
}

function scanArchive(buffer, relativePath) {
  const kind = archiveKind(relativePath);
  let entries;
  if (kind === "tar-gzip") {
    const expanded = gunzipSync(buffer, { maxOutputLength: MAX_ARCHIVE_BYTES });
    entries = parseTar(expanded);
  } else if (kind === "zip") {
    entries = parseZip(buffer);
  } else {
    return [];
  }

  const findings = [];
  for (const entry of entries) {
    const displayPath = archiveEntryPath(relativePath, entry.name);
    if (unsafeArchiveEntry(entry.name)) {
      findings.push(createFinding("archive:path-traversal", displayPath, entry.name));
      continue;
    }
    if (entry.size > MAX_ARCHIVE_ENTRY_BYTES) {
      findings.push(createFinding("scan:oversized-archive-entry", displayPath, String(entry.size)));
      continue;
    }
    if (entry.name.toLowerCase().endsWith(".map")) findings.push(sourceMapFinding(displayPath));
    findings.push(...contentFindings(entry.data, displayPath));
  }
  return findings;
}

async function collectFiles(rootDir) {
  const files = [];
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.name === ".git") continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORY_NAMES.has(entry.name)) await walk(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  };
  await walk(rootDir);
  return files;
}

function allowedFindingKeys(allowlist) {
  return new Set(
    allowlist.exceptions.map(
      (exception) =>
        `${exception.ruleId}\0${normalizeRelativePath(exception.relativePath)}\0${exception.findingSha256}`,
    ),
  );
}

function findingKey(finding) {
  return `${finding.ruleId}\0${finding.relativePath}\0${finding.findingSha256}`;
}

export async function scanReleaseTree({
  rootDir,
  allowlist = { schemaVersion: 1, exceptions: [] },
  now = new Date(),
}) {
  validateAllowlist(allowlist, now);
  const files = await collectFiles(rootDir);
  const findings = [];
  let scannedArchives = 0;

  for (const absolutePath of files) {
    const relativePath = normalizeRelativePath(path.relative(rootDir, absolutePath));
    const data = await readFile(absolutePath);
    if (relativePath.toLowerCase().endsWith(".map")) findings.push(sourceMapFinding(relativePath));
    if (data.length > MAX_FILE_BYTES) {
      findings.push(createFinding("scan:oversized-file", relativePath, String(data.length)));
      continue;
    }
    findings.push(...contentFindings(data, relativePath));
    if (archiveKind(relativePath)) {
      scannedArchives += 1;
      try {
        findings.push(...scanArchive(data, relativePath));
      } catch (error) {
        findings.push(
          createFinding(
            "archive:uninspectable",
            relativePath,
            error instanceof Error ? error.message : "Unknown archive error",
          ),
        );
      }
    }
  }

  findings.sort(
    (left, right) =>
      left.relativePath.localeCompare(right.relativePath) ||
      left.ruleId.localeCompare(right.ruleId),
  );
  const allowed = allowedFindingKeys(allowlist);
  const activeFindings = findings.filter((finding) => !allowed.has(findingKey(finding)));
  const allowlistedFindings = findings.filter((finding) => allowed.has(findingKey(finding)));
  return {
    schemaVersion: 1,
    status: activeFindings.length === 0 ? "passed" : "failed",
    scannedFiles: files.length,
    scannedArchives,
    findings: activeFindings,
    allowlistedFindings,
  };
}

function purlFor(name, version) {
  if (name.startsWith("@")) {
    const [scope, packageName] = name.split("/");
    return `pkg:npm/${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function cycloneDxLicenses(license) {
  if (/\s(?:AND|OR|WITH)\s/u.test(license)) return [{ expression: license }];
  if (/^[A-Za-z0-9-.+]+$/u.test(license)) return [{ license: { id: license } }];
  return [{ license: { name: license } }];
}

function licenseComponents(licenseInventory) {
  const components = new Map();
  for (const [licenseGroup, packages] of Object.entries(licenseInventory)) {
    for (const packageEntry of packages) {
      for (const version of packageEntry.versions ?? []) {
        const purl = purlFor(packageEntry.name, version);
        const existing = components.get(purl);
        const licenses = new Set(existing?.licenseValues ?? []);
        licenses.add(packageEntry.license || licenseGroup || "UNKNOWN");
        components.set(purl, {
          name: packageEntry.name,
          version,
          purl,
          homepage: packageEntry.homepage,
          description: packageEntry.description,
          licenseValues: [...licenses].sort(),
        });
      }
    }
  }
  return [...components.values()].sort((left, right) => left.purl.localeCompare(right.purl));
}

function deterministicSerial(rootPackage, components) {
  const digest = sha256(
    JSON.stringify({
      name: rootPackage.name,
      version: rootPackage.version,
      components: components.map((component) => component.purl),
    }),
  );
  const uuid = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  return `urn:uuid:${uuid}`;
}

export function buildCycloneDxBom({ licenseInventory, rootPackage, timestamp }) {
  const components = licenseComponents(licenseInventory);
  const rootPurl = purlFor(rootPackage.name, rootPackage.version);
  return {
    $schema: "http://cyclonedx.org/schema/bom-1.5.schema.json",
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: deterministicSerial(rootPackage, components),
    version: 1,
    metadata: {
      timestamp,
      tools: {
        components: [
          {
            type: "application",
            name: "Class A Bridge release-integrity generator",
            version: rootPackage.version,
          },
        ],
      },
      component: {
        type: "application",
        "bom-ref": rootPurl,
        name: rootPackage.name,
        version: rootPackage.version,
        licenses: cycloneDxLicenses(rootPackage.license ?? "Apache-2.0"),
        purl: rootPurl,
        supplier: { name: "Ancilis" },
      },
      properties: [{ name: "ancilis:inventory-source", value: "pnpm licenses list --prod --json" }],
    },
    components: components.map((component) => {
      const result = {
        type: "library",
        "bom-ref": component.purl,
        name: component.name,
        version: component.version,
        licenses: component.licenseValues.flatMap(cycloneDxLicenses),
        purl: component.purl,
      };
      if (component.description) result.description = component.description;
      if (component.homepage) {
        result.externalReferences = [{ type: "website", url: component.homepage }];
      }
      return result;
    }),
    dependencies: [
      { ref: rootPurl, dependsOn: components.map((component) => component.purl) },
      ...components.map((component) => ({ ref: component.purl, dependsOn: [] })),
    ],
  };
}

function licenseReviewState(license) {
  const normalized = license.toUpperCase();
  if (["", "UNKNOWN", "UNLICENSED", "NONE", "NOASSERTION"].includes(normalized)) return "blocked";
  if (/(?:^|[-.])(A?GPL|LGPL|SSPL|CC-BY|CDDL|EPL|MPL)/u.test(normalized)) {
    return "review-required";
  }
  return "accepted-by-policy";
}

export function buildLicenseReport(licenseInventory) {
  const components = licenseComponents(licenseInventory).map((component) => ({
    name: component.name,
    version: component.version,
    licenses: component.licenseValues,
    reviewState: component.licenseValues.map(licenseReviewState).includes("blocked")
      ? "blocked"
      : component.licenseValues.map(licenseReviewState).includes("review-required")
        ? "review-required"
        : "accepted-by-policy",
  }));
  const blocked = components.filter((component) => component.reviewState === "blocked");
  const reviewRequired = components.filter(
    (component) => component.reviewState === "review-required",
  );
  const licenseCounts = {};
  for (const component of components) {
    for (const license of component.licenses) {
      licenseCounts[license] = (licenseCounts[license] ?? 0) + 1;
    }
  }
  return {
    schemaVersion: 1,
    status: blocked.length === 0 ? "passed" : "failed",
    policy: {
      blocking: ["unknown, missing, unlicensed, or no-assertion license metadata"],
      manualReview: ["copyleft and Creative Commons dependency licenses"],
    },
    componentCount: components.length,
    licenseCounts: Object.fromEntries(
      Object.entries(licenseCounts).sort(([left], [right]) => left.localeCompare(right)),
    ),
    blocked,
    reviewRequired,
    components,
  };
}

export function summarizePnpmAudit(auditData) {
  if (!auditData?.metadata?.vulnerabilities) {
    throw new Error(
      "pnpm audit did not contain vulnerability metadata; no clean result can be asserted.",
    );
  }
  const sourceCounts = auditData?.metadata?.vulnerabilities ?? {};
  const vulnerabilities = {
    info: Number(sourceCounts.info ?? 0),
    low: Number(sourceCounts.low ?? 0),
    moderate: Number(sourceCounts.moderate ?? 0),
    high: Number(sourceCounts.high ?? 0),
    critical: Number(sourceCounts.critical ?? 0),
  };
  const advisories = Object.values(auditData?.advisories ?? {})
    .map((advisory) => ({
      id: advisory.id,
      moduleName: advisory.module_name ?? advisory.moduleName ?? "unknown",
      severity: advisory.severity ?? "unknown",
      title: advisory.title ?? "Untitled advisory",
      url: advisory.url,
      vulnerableVersions: advisory.vulnerable_versions ?? advisory.vulnerableVersions,
      patchedVersions: advisory.patched_versions ?? advisory.patchedVersions,
    }))
    .sort((left, right) => String(left.moduleName).localeCompare(String(right.moduleName)));
  const blockingVulnerabilityCount = vulnerabilities.high + vulnerabilities.critical;
  return {
    schemaVersion: 1,
    status: blockingVulnerabilityCount === 0 ? "passed" : "failed",
    releaseThreshold: "high",
    vulnerabilities,
    blockingVulnerabilityCount,
    nonBlockingVulnerabilityCount:
      vulnerabilities.info + vulnerabilities.low + vulnerabilities.moderate,
    dependencyCount: Number(
      auditData?.metadata?.totalDependencies ?? auditData?.metadata?.dependencies ?? 0,
    ),
    advisories,
  };
}
