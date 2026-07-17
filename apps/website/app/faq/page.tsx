import type { Metadata } from "next";

import { FaqList } from "../../components/faq-list";
import { JsonLd } from "../../components/json-ld";
import { PageTemplate } from "../../components/page-template";
import { faqStructuredData, createPageMetadata } from "../../content/metadata";
import { requirePage } from "../../content/pages";
import { faqItems } from "../../content/site-content";

const page = requirePage("/faq/");

export const metadata: Metadata = createPageMetadata(page);

export default function FaqPage() {
  return (
    <PageTemplate page={page}>
      <section className="content-section shell faq-page" aria-labelledby="faq-list-title">
        <div className="content-section__heading">
          <p className="eyebrow">Product boundaries</p>
          <h2 id="faq-list-title">Ten questions worth answering clearly</h2>
        </div>
        <div className="content-section__body">
          <FaqList items={faqItems} />
        </div>
        <JsonLd data={faqStructuredData} />
      </section>
    </PageTemplate>
  );
}
