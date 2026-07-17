export interface LocalPdfFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

export interface PdfExtractionCandidate {
  readonly id: string;
  readonly field: string;
  readonly value: string;
  readonly page: number;
  readonly snippet: string;
  readonly confidence: "high" | "medium" | "low";
  readonly detector: string;
  readonly decision: "unreviewed" | "confirmed" | "edited" | "ignored";
}

export interface LocalPdfResult {
  readonly pages: readonly string[];
  readonly candidates: readonly PdfExtractionCandidate[];
  readonly warning?: string;
}

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 500;
const MAX_EXTRACTED_TEXT_CHARACTERS = 10_000_000;
// Removing embedded control characters prevents document text from changing display semantics.
// eslint-disable-next-line no-control-regex
const DOCUMENT_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu;

export function validatePdfFile(file: LocalPdfFile): string | undefined {
  const hasPdfName = file.name.toLowerCase().endsWith(".pdf");
  const hasPdfType = file.type === "application/pdf" || file.type === "";
  if (!hasPdfName || !hasPdfType) return "Choose a PDF file. Other file types are not parsed.";
  if (file.size > MAX_PDF_BYTES) return "The PDF is larger than the 25 MB local-processing limit.";
  if (file.size === 0) return "The PDF is empty.";
  return undefined;
}

function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .replaceAll(DOCUMENT_CONTROL_CHARACTERS, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, 2_000_000);
}

export function collectBoundedTextFragments(
  fragments: readonly string[],
  maximumCharacters: number,
): { readonly text: string; readonly truncated: boolean } {
  const limit = Math.max(0, Math.floor(maximumCharacters));
  const parts: string[] = [];
  let used = 0;
  let truncated = false;
  for (const fragment of fragments) {
    if (used >= limit) {
      truncated = true;
      break;
    }
    if (parts.length > 0) {
      parts.push(" ");
      used += 1;
      if (used >= limit) {
        truncated = true;
        break;
      }
    }
    const remaining = limit - used;
    const selected = fragment.slice(0, remaining);
    parts.push(selected);
    used += selected.length;
    if (selected.length < fragment.length) {
      truncated = true;
      break;
    }
  }
  return { text: parts.join(""), truncated };
}

function snippet(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + length + 110);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

interface Detector {
  readonly field: string;
  readonly pattern: RegExp;
  readonly confidence: PdfExtractionCandidate["confidence"];
  readonly value: (match: RegExpExecArray) => string;
}

const MONTH_NUMBER: Readonly<Record<string, string>> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function isoDate(input: string): string {
  const match = /^([A-Z][a-z]+)\s+(\d{1,2}),?\s+(20\d{2})$/u.exec(input.trim());
  if (!match) return input.trim();
  const month = MONTH_NUMBER[(match[1] ?? "").toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || day < 1 || day > 31) return input.trim();
  const normalized = `${year}-${month}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === Number(month) &&
    parsed.getUTCDate() === day
    ? normalized
    : input.trim();
}

const detectors: readonly Detector[] = [
  {
    field: "SOC 2 report type",
    pattern: /\bSOC\s*2\b.{0,60}\bType\s+II\b/iu,
    confidence: "high",
    value: () => "SOC 2 Type II",
  },
  {
    field: "Report issuer",
    pattern:
      /(?:report\s+issuer|independent\s+service\s+auditor|auditor|issued\s+by)\s*(?::|—|-)\s*([A-Z][A-Za-z0-9&,'’ .-]{1,120}?(?:L\.L\.P\.|L\.L\.C\.|LLP|LLC|P\.?C\.?|PLLC|Inc\.?|Corporation|Company))/iu,
    confidence: "medium",
    value: (match) => match[1] ?? match[0],
  },
  {
    field: "Report date",
    pattern:
      /(?:report|opinion|issuance)\s+date\s*(?::|—|-)?\s*([A-Z][a-z]+\s+\d{1,2},?\s+20\d{2})/iu,
    confidence: "high",
    value: (match) => isoDate(match[1] ?? match[0]),
  },
  {
    field: "Report period",
    pattern:
      /(?:period|from)\s+([A-Z][a-z]+\s+\d{1,2},?\s+20\d{2})\s+(?:through|to|—|-)\s+([A-Z][a-z]+\s+\d{1,2},?\s+20\d{2})/iu,
    confidence: "medium",
    value: (match) => `${isoDate(match[1] ?? "")} to ${isoDate(match[2] ?? "")}`,
  },
  {
    field: "System or service name",
    pattern: /\b([A-Z][A-Za-z0-9&' -]{2,80}(?:Cloud|Platform|Service|System|API))\b/gu,
    confidence: "low",
    value: (match) => match[1] ?? match[0],
  },
  {
    field: "Trust Services Criteria",
    pattern:
      /\b(Security(?:,?\s+(?:Availability|Confidentiality|Processing Integrity|Privacy|and)){0,8})\s+(?:Trust Services )?[Cc]riteria\b/iu,
    confidence: "medium",
    value: (match) => match[1] ?? match[0],
  },
  {
    field: "Control identifier",
    pattern: /\b(?:control\s+)?([A-Z]{1,12}(?:-[A-Z0-9]{1,12})*[-.]?[A-Z]*\d+(?:\.\d+)*)\b/gu,
    confidence: "low",
    value: (match) => match[1] ?? match[0],
  },
  {
    field: "Subservice organization",
    pattern: /\bsubservice organizations?\b.{0,180}/giu,
    confidence: "medium",
    value: (match) => match[0],
  },
  {
    field: "Carve-out treatment",
    pattern: /\bcarve[- ]out (?:method|treatment)\b/iu,
    confidence: "high",
    value: () => "Carve-out treatment mentioned",
  },
  {
    field: "Inclusive treatment",
    pattern: /\binclusive (?:method|treatment)\b/iu,
    confidence: "high",
    value: () => "Inclusive treatment mentioned",
  },
  {
    field: "Auditor exception",
    pattern: /\b(?:exception|deviation)\b.{0,180}/giu,
    confidence: "low",
    value: (match) => match[0],
  },
  {
    field: "Complementary user-entity controls",
    pattern: /\bcomplementary user[- ]entity controls?\b/iu,
    confidence: "high",
    value: () => "Complementary user-entity controls mentioned",
  },
  {
    field: "Bridge or gap letter reference",
    pattern: /\b(?:bridge|gap) letter\b/iu,
    confidence: "medium",
    value: (match) => match[0],
  },
];

export function extractSoc2Candidates(pages: readonly string[]): PdfExtractionCandidate[] {
  const results: PdfExtractionCandidate[] = [];
  const duplicates = new Set<string>();
  pages.forEach((raw, pageIndex) => {
    const text = normalizeText(raw);
    for (const detector of detectors) {
      const pattern = new RegExp(detector.pattern.source, detector.pattern.flags);
      let match = pattern.exec(text);
      let matchCount = 0;
      while (match && matchCount < 30) {
        const value = normalizeText(detector.value(match)).slice(0, 500);
        const duplicateKey = `${detector.field}:${value.toLowerCase()}`;
        if (!duplicates.has(duplicateKey)) {
          duplicates.add(duplicateKey);
          results.push({
            id: `pdf-${pageIndex + 1}-${results.length + 1}`,
            field: detector.field,
            value,
            page: pageIndex + 1,
            snippet: snippet(text, match.index, match[0].length),
            confidence: detector.confidence,
            detector: "Deterministic local pattern",
            decision: "unreviewed",
          });
        }
        matchCount += 1;
        if (!pattern.global) break;
        match = pattern.exec(text);
      }
    }
  });
  return results;
}

export async function parsePdfLocally(file: File): Promise<LocalPdfResult> {
  const validationError = validatePdfFile(file);
  if (validationError) throw new Error(validationError);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error("This file does not have a valid PDF signature. Continue with manual entry.");
  }

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const task = pdfjs.getDocument({
      data: bytes,
      disableAutoFetch: true,
      disableStream: true,
      useWorkerFetch: false,
    });
    const document = await task.promise;
    const pages: string[] = [];
    let remainingTextCharacters = MAX_EXTRACTED_TEXT_CHARACTERS;
    let safetyLimitReached = document.numPages > MAX_PDF_PAGES;
    for (
      let pageNumber = 1;
      pageNumber <= Math.min(document.numPages, MAX_PDF_PAGES);
      pageNumber += 1
    ) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent({ disableNormalization: false });
      const collected = collectBoundedTextFragments(
        content.items.map((item) =>
          "str" in item && typeof item.str === "string" ? item.str : "",
        ),
        remainingTextCharacters,
      );
      const pageText = normalizeText(collected.text).slice(0, remainingTextCharacters);
      pages.push(pageText);
      remainingTextCharacters -= pageText.length;
      page.cleanup();
      if (collected.truncated || remainingTextCharacters <= 0) {
        safetyLimitReached = true;
        break;
      }
    }
    await document.cleanup();
    await task.destroy();
    const candidates = extractSoc2Candidates(pages);
    const hasText = pages.some((page) => page.length > 20);
    return {
      pages,
      candidates,
      ...(safetyLimitReached
        ? {
            warning:
              "Local extraction stopped at the PDF page or text safety limit. Review the extracted candidates and enter any remaining report details manually.",
          }
        : !hasText
          ? {
              warning:
                "No usable text was found. The report may be scanned or image-only; continue with manual entry.",
            }
          : candidates.length === 0
            ? {
                warning:
                  "Text was extracted, but no reliable metadata candidates were found. Continue with manual entry.",
              }
            : {}),
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (/password/iu.test(name) || (error instanceof Error && /password/iu.test(error.message))) {
      throw new Error(
        "This PDF is password-protected. Unlock a local copy or continue with manual entry.",
        { cause: error },
      );
    }
    throw new Error(
      "The PDF could not be read locally. It may be scanned, malformed, or unsupported; continue with manual entry.",
      { cause: error },
    );
  }
}
