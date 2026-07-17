import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { generateCsv, generateEditableDocx } from "../src/index";
import { createDocumentProject, GENERATED_AT } from "./fixture";

describe("editable exports", () => {
  it("escapes formula-significant CSV cells", () => {
    const artifact = generateCsv(createDocumentProject(), "action-plan");

    expect(artifact.text).toContain("'=HYPERLINK");
    expect(artifact.text).not.toMatch(/\n=HYPERLINK/u);
    expect(artifact.mimeType).toBe("text/csv;charset=utf-8");
  });

  it("creates a minimal standards-based DOCX without embedding HTML", () => {
    const artifact = generateEditableDocx(createDocumentProject(), "action-plan", {
      generatedAt: GENERATED_AT,
    });
    const files = unzipSync(artifact.bytes);
    const documentXml = new TextDecoder().decode(files["word/document.xml"]);

    expect(artifact.fileName).toMatch(/\.docx$/u);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(["[Content_Types].xml", "_rels/.rels", "word/document.xml"]),
    );
    expect(documentXml).toContain("Action plan");
    expect(documentXml).not.toContain("<script>");
  });
});
