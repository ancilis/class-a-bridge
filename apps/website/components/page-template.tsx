import { ButtonLink } from "./button-link";
import type { ContentSection, StaticPageDefinition } from "../content/types";

interface PageTemplateProps {
  readonly page: StaticPageDefinition;
  readonly children?: React.ReactNode;
}

function ContentSectionView({ section }: { readonly section: ContentSection }) {
  return (
    <section
      className="content-section shell"
      id={section.id}
      aria-labelledby={`${section.id}-title`}
    >
      <div className="content-section__heading">
        {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
        <h2 id={`${section.id}-title`}>{section.title}</h2>
      </div>
      <div className="content-section__body">
        {section.body?.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {section.bullets ? (
          <ul className="check-list">
            {section.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
        {section.cards ? (
          <div className="content-cards">
            {section.cards.map((card) => (
              <article key={card.title} className="content-card">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                {card.href && card.linkLabel ? (
                  <a
                    className="text-link"
                    href={card.href}
                    rel={card.href.startsWith("https://") ? "noreferrer" : undefined}
                  >
                    {card.linkLabel}
                    <span aria-hidden="true">{card.href.startsWith("https://") ? " ↗" : " →"}</span>
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
        {section.note ? (
          <aside className="section-note" aria-label="Important note">
            <span aria-hidden="true">i</span>
            <p>{section.note}</p>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

export function PageTemplate({ page, children }: PageTemplateProps) {
  return (
    <main id="main-content">
      <header className="page-hero">
        <div className="shell page-hero__inner">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1>{page.headline}</h1>
          <p className="page-hero__intro">{page.intro}</p>
        </div>
      </header>

      {children}
      {page.sections.map((section) => (
        <ContentSectionView key={section.id} section={section} />
      ))}

      {page.cta ? (
        <section className="page-cta shell" aria-labelledby="page-cta-title">
          <div>
            <p className="eyebrow">A clear next step</p>
            <h2 id="page-cta-title">{page.cta.title}</h2>
            <p>{page.cta.body}</p>
          </div>
          <div className="button-row">
            <ButtonLink href={page.cta.primaryHref}>{page.cta.primaryLabel}</ButtonLink>
            {page.cta.secondaryHref && page.cta.secondaryLabel ? (
              <ButtonLink href={page.cta.secondaryHref} variant="secondary">
                {page.cta.secondaryLabel}
              </ButtonLink>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
