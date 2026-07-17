import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FaqList } from "../components/faq-list";
import { ContactForm } from "../components/contact-form";
import { JsonLd } from "../components/json-ld";
import { PageTemplate } from "../components/page-template";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { pageByPath } from "../content/pages";
import { faqItems } from "../content/site-content";

describe("static website rendering", () => {
  it("renders a named navigation landmark and application call to action", () => {
    const markup = renderToStaticMarkup(<SiteHeader />);

    expect(markup).toContain('<nav aria-label="Primary navigation"');
    expect(markup).toContain("Class A Bridge");
    expect(markup).toContain('href="/launch/"');
  });

  it("renders page content with one primary heading and labelled sections", () => {
    const page = pageByPath.get("/product/");
    if (!page) throw new Error("Product page fixture is missing");

    const markup = renderToStaticMarkup(<PageTemplate page={page} />);

    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain("Four practical outcomes");
    expect(markup).toContain('aria-labelledby="outcomes-title"');
    expect(markup).toContain("Start the free assessment");
  });

  it("uses semantic disclosures for frequently asked questions", () => {
    const markup = renderToStaticMarkup(<FaqList items={faqItems} />);

    expect(markup.match(/<details/g)).toHaveLength(faqItems.length);
    expect(markup).toContain("Does this make us FedRAMP certified?");
  });

  it("renders legal and privacy navigation in the footer", () => {
    const markup = renderToStaticMarkup(<SiteFooter />);

    expect(markup).toContain('aria-label="Footer navigation"');
    expect(markup).toContain('href="/privacy/"');
    expect(markup).toContain('href="/disclaimer/"');
    expect(markup).toContain("Not affiliated with, endorsed by, or certified by GSA or FedRAMP");
  });

  it("renders structured data as a non-executable JSON script", () => {
    const markup = renderToStaticMarkup(
      <JsonLd data={{ "@context": "https://schema.org", name: "Bridge" }} />,
    );

    expect(markup).toContain('type="application/ld+json"');
    expect(markup).toContain("https://schema.org");
  });

  it("keeps the contact flow limited to approved contact fields", () => {
    const markup = renderToStaticMarkup(<ContactForm endpoint={undefined} />);

    expect(markup).toContain('name="email"');
    expect(markup).toContain('name="includeSummary"');
    expect(markup).toContain("A contact endpoint is not configured");
    expect(markup).not.toContain('type="file"');
    expect(markup).not.toContain("contact-message-error");
  });
});
