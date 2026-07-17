import { describe, expect, it } from "vitest";

import {
  baseUrl,
  createPageMetadata,
  faqStructuredData,
  organizationStructuredData,
  serializeStructuredData,
  softwareStructuredData,
} from "../content/metadata";
import { pageByPath } from "../content/pages";
import { faqItems } from "../content/site-content";

describe("search metadata", () => {
  it("creates unique canonical and social metadata for a content page", () => {
    const page = pageByPath.get("/methodology/");
    if (!page) throw new Error("Methodology page fixture is missing");

    const metadata = createPageMetadata(page);

    expect(metadata.title).toBe(page.title);
    expect(metadata.description).toBe(page.description);
    expect(metadata.alternates?.canonical).toBe(`${baseUrl}${page.path}`);
    expect(metadata.openGraph?.url).toBe(`${baseUrl}${page.path}`);
  });

  it("describes the maintainer, software boundary, and complete FAQ", () => {
    expect(organizationStructuredData["@type"]).toBe("Organization");
    expect(softwareStructuredData["@type"]).toBe("SoftwareApplication");
    expect(softwareStructuredData.applicationCategory).toBe("BusinessApplication");
    expect(faqStructuredData.mainEntity).toHaveLength(faqItems.length);
  });

  it("escapes markup-significant characters in JSON-LD", () => {
    expect(serializeStructuredData({ value: "</script><script>" })).toBe(
      '{"value":"\\u003c/script>\\u003cscript>"}',
    );
  });
});
