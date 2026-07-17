import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import addFormats from "ajv-formats";

interface LoadedSchema extends Record<string, unknown> {
  $id?: string;
  $defs?: Record<string, unknown>;
  title?: string;
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entries = {
  acceptedVulnerabilityInfo: "fedramp-accepted-vulnerability-info-schema-2026-06-24.json",
  advisorInformation: "fedramp-advisor-information-schema-2026-06-24.json",
  assessorInformation: "fedramp-assessor-information-schema-2026-06-24.json",
  certificationPackageOverview: "fedramp-certification-package-overview-schema-2026-06-24.json",
  commonDefinitions: "fedramp-common-definitions-schema-2026-06-24.json",
  historicalVerActivity: "fedramp-historical-ver-activity-schema-2026-06-24.json",
  incidentReport: "fedramp-incident-report-schema-2026-06-24.json",
  ongoingCertificationReport: "fedramp-ongoing-certification-report-schema-2026-06-24.json",
  securityDecisionRecord: "fedramp-security-decision-record-schema-2026-06-24.json",
  significantChangeNotifications: "fedramp-significant-change-notifications-schema-2026-06-24.json",
  vulnerabilityDetailReport: "fedramp-vulnerability-detail-report-schema-2026-06-24.json",
} as const;

const schemas = await Promise.all(
  Object.values(entries).map(
    async (file) =>
      JSON.parse(
        await readFile(resolve(packageRoot, "vendor", file), "utf8"),
      ) as unknown as LoadedSchema,
  ),
);

const ajv = new Ajv2020({
  allErrors: true,
  code: { esm: true, source: true },
  strict: false,
});
addFormats(ajv);
for (const schema of schemas) ajv.addSchema(schema);

// The official 2026 schemas address common definitions as URL path segments
// (`...json/$defs/name`) rather than JSON fragments (`...json#/$defs/name`).
// Register read-only aliases at compile time while keeping every vendored byte
// untouched and checksum-verifiable.
const common = schemas.find((schema) => schema.title === "FedRAMP Common Definitions");
if (!common?.$id || typeof common.$defs !== "object") {
  throw new Error("Official common definitions schema is missing $id or $defs");
}
const normalizeCommonRefs = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeCommonRefs);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "$ref" && typeof child === "string" && child.startsWith("#/$defs/")
        ? `${common.$id}/${child.slice(2)}`
        : normalizeCommonRefs(child),
    ]),
  );
};
for (const [name, definition] of Object.entries(common.$defs)) {
  ajv.addSchema({
    ...(normalizeCommonRefs(definition) as Record<string, unknown>),
    $id: `${common.$id}/$defs/${name}`,
  });
}

const references = Object.fromEntries(
  Object.entries(entries).map(([exportName, file]) => {
    const schema = schemas.find((candidate) => String(candidate.$id ?? "").endsWith(file));
    if (!schema?.$id) throw new Error(`Missing $id for ${file}`);
    return [exportName, schema.$id];
  }),
);

const output = `${standaloneCode(ajv, references)}\n`;
await writeFile(resolve(packageRoot, "src/generated/validators.mjs"), output, "utf8");
