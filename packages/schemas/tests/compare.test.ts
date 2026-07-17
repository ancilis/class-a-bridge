import { describe, expect, it } from "vitest";

import { compareSchemaFiles, schemaFilesFromIndex } from "../scripts/compare-official";

describe("official schema comparison", () => {
  it("extracts and deduplicates official dated schema filenames", () => {
    const file = "fedramp-security-decision-record-schema-2026-06-24.json";
    expect(schemaFilesFromIndex(`<a href="/schemas/${file}">${file}</a>${file}`)).toEqual([file]);
  });

  it("reports added, removed, and byte-changed schema files", () => {
    expect(
      compareSchemaFiles(
        new Map([
          ["same.json", "a"],
          ["changed.json", "old"],
          ["removed.json", "r"],
        ]),
        new Map([
          ["same.json", "a"],
          ["changed.json", "new"],
          ["added.json", "n"],
        ]),
      ),
    ).toEqual({
      added: ["added.json"],
      removed: ["removed.json"],
      changed: ["changed.json"],
    });
  });
});
