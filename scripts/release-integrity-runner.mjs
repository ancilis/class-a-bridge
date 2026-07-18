import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCycloneDxBom,
  buildLicenseReport,
  scanReleaseTree,
  summarizePnpmAudit,
} from "./release-integrity-core.mjs";

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function markdownCell(value) {
  return String(value ?? "—")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function integrityMarkdown(report) {
  const lines = [
    "# Release integrity scan",
    "",
    `Status: **${report.status.toUpperCase()}**`,
    "",
    `Scanned files: ${report.scannedFiles}`,
    `Scanned archives: ${report.scannedArchives}`,
    `Active findings: ${report.findings.length}`,
    `Reviewed allowlist matches: ${report.allowlistedFindings.length}`,
    "",
    "The scan covers repository source and generated distribution files while excluding dependency, cache, and intermediate-framework directories. Finding reports contain repository-relative locations and cryptographic fingerprints, never matched secret content.",
    "",
  ];
  if (report.findings.length === 0) {
    lines.push("No release-blocking integrity finding was detected.", "");
  } else {
    lines.push(
      "## Release-blocking findings",
      "",
      "| Rule | Repository-relative location | Line | Finding SHA-256 |",
      "| --- | --- | ---: | --- |",
      ...report.findings.map(
        (finding) =>
          `| ${markdownCell(finding.ruleId)} | ${markdownCell(finding.relativePath)} | ${markdownCell(finding.line)} | ${finding.findingSha256} |`,
      ),
      "",
    );
  }
  if (report.allowlistedFindings.length > 0) {
    lines.push(
      "## Reviewed exceptions encountered",
      "",
      "| Rule | Repository-relative location | Finding SHA-256 |",
      "| --- | --- | --- |",
      ...report.allowlistedFindings.map(
        (finding) =>
          `| ${markdownCell(finding.ruleId)} | ${markdownCell(finding.relativePath)} | ${finding.findingSha256} |`,
      ),
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

function licenseMarkdown(report) {
  const lines = [
    "# Production dependency license summary",
    "",
    `Automated policy status: **${report.status.toUpperCase()}**`,
    "",
    `Production components inventoried: ${report.componentCount}`,
    `Components blocked by missing or unknown metadata: ${report.blocked.length}`,
    `Components requiring substantive license review: ${report.reviewRequired.length}`,
    "",
    "Automated status checks metadata completeness. Copyleft and Creative Commons licenses remain explicit human-review items and are not silently approved by this report.",
    "",
    "## License counts",
    "",
    "| Declared license | Components |",
    "| --- | ---: |",
    ...Object.entries(report.licenseCounts).map(
      ([license, count]) => `| ${markdownCell(license)} | ${count} |`,
    ),
    "",
  ];
  if (report.reviewRequired.length > 0) {
    lines.push(
      "## Human review required",
      "",
      "| Package | Version | Declared license |",
      "| --- | --- | --- |",
      ...report.reviewRequired.map(
        (component) =>
          `| ${markdownCell(component.name)} | ${markdownCell(component.version)} | ${markdownCell(component.licenses.join(", "))} |`,
      ),
      "",
    );
  }
  if (report.blocked.length > 0) {
    lines.push(
      "## Blocking metadata gaps",
      "",
      "| Package | Version | Declared license |",
      "| --- | --- | --- |",
      ...report.blocked.map(
        (component) =>
          `| ${markdownCell(component.name)} | ${markdownCell(component.version)} | ${markdownCell(component.licenses.join(", "))} |`,
      ),
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

function auditMarkdown(report) {
  const lines = [
    "# Production dependency vulnerability audit",
    "",
    `Release-threshold status: **${report.status.toUpperCase()}**`,
    "",
    `Blocking threshold: ${report.releaseThreshold} or critical`,
    `Production dependencies reported by pnpm: ${report.dependencyCount}`,
    "",
    "| Severity | Count |",
    "| --- | ---: |",
    `| Critical | ${report.vulnerabilities.critical} |`,
    `| High | ${report.vulnerabilities.high} |`,
    `| Moderate | ${report.vulnerabilities.moderate} |`,
    `| Low | ${report.vulnerabilities.low} |`,
    `| Informational | ${report.vulnerabilities.info} |`,
    "",
  ];
  if (report.advisories.length > 0) {
    lines.push(
      "## Reported advisories",
      "",
      "| Package | Severity | Advisory | Patched versions |",
      "| --- | --- | --- | --- |",
      ...report.advisories.map(
        (advisory) =>
          `| ${markdownCell(advisory.moduleName)} | ${markdownCell(advisory.severity)} | ${markdownCell(advisory.title)} | ${markdownCell(advisory.patchedVersions)} |`,
      ),
      "",
    );
  } else {
    lines.push("No advisory was reported by the pnpm production dependency audit.", "");
  }
  return `${lines.join("\n")}\n`;
}

export async function generateReleaseIntegrityReport({ rootDir, reportDir, allowlist, now }) {
  const report = await scanReleaseTree({ rootDir, allowlist, now });
  await mkdir(reportDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(reportDir, "release-integrity.json"), json(report), "utf8"),
    writeFile(path.join(reportDir, "release-integrity.md"), integrityMarkdown(report), "utf8"),
  ]);
  return report;
}

export async function generateSupplyChainReports({
  reportDir,
  licenseInventory,
  auditData,
  rootPackage,
  timestamp,
}) {
  const licenseReport = buildLicenseReport(licenseInventory);
  const auditReport = summarizePnpmAudit(auditData);
  const sbom = buildCycloneDxBom({ licenseInventory, rootPackage, timestamp });
  const status =
    licenseReport.status === "passed" && auditReport.status === "passed" ? "passed" : "failed";
  await mkdir(reportDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(reportDir, "license-summary.json"), json(licenseReport), "utf8"),
    writeFile(path.join(reportDir, "license-summary.md"), licenseMarkdown(licenseReport), "utf8"),
    writeFile(path.join(reportDir, "dependency-audit.json"), json(auditReport), "utf8"),
    writeFile(path.join(reportDir, "dependency-audit.md"), auditMarkdown(auditReport), "utf8"),
    writeFile(path.join(reportDir, "sbom.cdx.json"), json(sbom), "utf8"),
  ]);
  return { status, licenseReport, auditReport, sbom };
}
