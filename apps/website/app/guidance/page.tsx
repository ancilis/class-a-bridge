import type { Metadata } from "next";
import { PageTemplate } from "../../components/page-template";
import { createPageMetadata } from "../../content/metadata";
import { requirePage } from "../../content/pages";
import { glossaryTerms } from "../../content/site-content";

const page = requirePage("/guidance/");
export const metadata: Metadata = createPageMetadata(page);
export default function GuidancePage() {
  return (
    <PageTemplate page={page}>
      <section className="content-section shell glossary-section" aria-labelledby="glossary-title">
        <div className="content-section__heading">
          <p className="eyebrow">Plain-language glossary</p>
          <h2 id="glossary-title">Terms you can learn as you work</h2>
        </div>
        <div className="content-section__body">
          <dl className="glossary-list">
            {glossaryTerms.map((item) => (
              <div key={item.term}>
                <dt>{item.term}</dt>
                <dd>{item.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </PageTemplate>
  );
}
