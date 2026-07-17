import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { SCHEMA_MANIFEST, validateOfficialDocument } from "../src/index";

describe("official schema manifest", () => {
  it("pins all eleven official schema byte streams", () => {
    expect(SCHEMA_MANIFEST).toHaveLength(11);
    for (const entry of SCHEMA_MANIFEST) {
      const path = fileURLToPath(new URL(`../vendor/${entry.file}`, import.meta.url));
      const bytes = readFileSync(path);
      expect(createHash("sha256").update(bytes).digest("hex"), entry.file).toBe(entry.sha256);
      expect(bytes.byteLength, entry.file).toBe(entry.bytes);
      expect(entry.retrievedAt).toBe("2026-07-17");
      expect(entry.localChanges).toBe("none");
      expect(entry.url).toBe(`https://www.fedramp.gov/schemas/${entry.file}`);
      expect(entry.id).toMatch(/^https:\/\/fedramp\.gov\/schemas\//u);
      expect(entry.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/u);
    }
  });

  it("validates a certification package overview entirely from vendored schemas", () => {
    const result = validateOfficialDocument("certification-package-overview", {
      serviceIdentification: {
        providerName: "Acme Metrics",
        serviceName: "Acme Metrics Federal",
        serviceAcronym: "AMF",
        serviceDescription: "Fictional example service.",
        certificationType: "20x",
        fedRampPackageId: "ACME-AMF",
        website: "https://example.invalid/acme",
        logo: "https://example.invalid/acme/logo.svg",
      },
      serviceProperties: {
        serviceType: ["SaaS"],
        deploymentModel: "Public Cloud",
      },
      contactInformation: [
        { contactType: "Security", contactEmail: "security@example.invalid" },
        { contactType: "Sales", contactEmail: "sales@example.invalid" },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("maps validation failures to friendly offline issues", () => {
    const result = validateOfficialDocument("certification-package-overview", {
      serviceIdentification: { certificationType: "Class A" },
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          document: "certification-package-overview",
          pointer: expect.any(String),
          route: expect.stringMatching(/^#\/package/u),
          expected: expect.any(String),
          resolution: expect.stringMatching(/add|choose|provide/iu),
        }),
      ]),
    );
  });
});
