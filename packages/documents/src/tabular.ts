import { csvCell, safeFilename } from "@class-a-bridge/project";
import type { BridgeProject } from "@class-a-bridge/project";
import { zipSync } from "fflate";

import { generateHumanReport } from "./reports";
import type { CsvArtifact, CsvKind, DocxArtifact, GenerationOptions, ReportKind } from "./types";

const encoder = new TextEncoder();

const row = (values: readonly unknown[]) =>
  values.map((value) => csvCell(value as string)).join(",");

const csvRows = (project: BridgeProject, kind: CsvKind): readonly (readonly unknown[])[] => {
  switch (kind) {
    case "action-plan":
      return [
        [
          "ID",
          "Title",
          "Description",
          "Category",
          "Priority",
          "Owner",
          "Due date",
          "Status",
          "Source references",
          "Next route",
        ],
        ...project.actions.map((action) => [
          action.id,
          action.title,
          action.description,
          action.category,
          action.priority,
          action.owner,
          action.dueDate ?? "",
          action.status,
          action.sourceRefs.join("; "),
          action.nextRoute,
        ]),
      ];
    case "evidence-manifest":
      return [
        [
          "ID",
          "Title",
          "Description",
          "Type",
          "Source system",
          "Owner",
          "Collected",
          "Relevant period",
          "Review date",
          "Requirements",
          "SOC 2 controls",
          "SHA-256",
          "Sensitivity",
          "Review status",
        ],
        ...project.evidence.map((item) => [
          item.id,
          item.title,
          item.description,
          item.kind,
          item.sourceSystem ?? "",
          item.owner,
          item.collectedAt,
          item.relevantPeriod ?? "",
          item.reviewDate ?? "",
          item.relatedRequirementIds.join("; "),
          item.relatedSoc2ControlIds.join("; "),
          item.sha256,
          item.sensitivity,
          item.reviewStatus,
        ]),
      ];
    case "requirements":
      return [
        [
          "Rule ID",
          "Status",
          "Review status",
          "Owner",
          "Due date",
          "SOC 2 controls",
          "SOC 2 pages",
          "Evidence IDs",
          "Open questions",
        ],
        ...project.requirements.map((requirement) => [
          requirement.ruleId,
          requirement.status,
          requirement.reviewStatus,
          requirement.owner,
          requirement.dueDate ?? "",
          requirement.soc2ControlIds.join("; "),
          requirement.soc2PageReferences.join("; "),
          requirement.evidenceIds.join("; "),
          requirement.openQuestions.join("; "),
        ]),
      ];
    case "soc2-mapping":
      return [
        [
          "Mapping ID",
          "SOC 2 control",
          "Report page",
          "Relevant excerpt",
          "Class A rule",
          "Coverage",
          "Reason",
          "Gap",
          "Additional evidence",
          "Suggested",
          "Confirmed",
          "Reviewer",
          "Review date",
        ],
        ...project.mappings.map((mapping) => [
          mapping.id,
          mapping.soc2ControlId,
          mapping.reportPage,
          mapping.excerpt,
          mapping.classARuleId,
          mapping.coverage,
          mapping.reason,
          mapping.gapDescription,
          mapping.additionalEvidenceNeeded,
          mapping.suggested,
          mapping.confirmed,
          mapping.reviewer ?? "",
          mapping.reviewDate ?? "",
        ]),
      ];
  }
};

export function generateCsv(project: BridgeProject, kind: CsvKind): CsvArtifact {
  const text = `\ufeff${csvRows(project, kind).map(row).join("\r\n")}\r\n`;
  return {
    kind,
    fileName: safeFilename(`${kind}.csv`),
    mimeType: "text/csv;charset=utf-8",
    text,
    bytes: encoder.encode(text),
  };
}

const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const relationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

const wordRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
</w:styles>`;

export function generateEditableDocx(
  project: BridgeProject,
  kind: ReportKind,
  options: GenerationOptions = {},
): DocxArtifact {
  const report = generateHumanReport(project, kind, options);
  const paragraphs = report.plainText
    .split(/\n+/u)
    .map((line, index) => {
      const style = index === 0 ? '<w:pPr><w:pStyle w:val="Title"/></w:pPr>' : "";
      return `<w:p>${style}<w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`;
    })
    .join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`;
  const generatedAt = options.generatedAt ?? report.generatedAt;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(report.title)}</dc:title><dc:creator>Ancilis</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${xml(generatedAt)}</dcterms:created></cp:coreProperties>`;
  const bytes = zipSync(
    {
      "[Content_Types].xml": encoder.encode(contentTypes),
      "_rels/.rels": encoder.encode(relationships),
      "word/_rels/document.xml.rels": encoder.encode(wordRelationships),
      "word/document.xml": encoder.encode(document),
      "word/styles.xml": encoder.encode(styles),
      "docProps/core.xml": encoder.encode(core),
    },
    { level: 6 },
  );
  return {
    fileName: report.fileName.replace(/\.html$/u, ".docx"),
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes,
  };
}
