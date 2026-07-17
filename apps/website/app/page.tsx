import type { Metadata } from "next";

import { ButtonLink } from "../components/button-link";
import { FaqList } from "../components/faq-list";
import { JsonLd } from "../components/json-ld";
import { faqStructuredData } from "../content/metadata";
import { faqItems, homepage } from "../content/site-content";

export const metadata: Metadata = {
  title: "SOC 2 to FedRAMP 20x Class A preparation",
};

export default function HomePage() {
  return (
    <main id="main-content">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="shell home-hero__grid">
          <div className="home-hero__copy">
            <p className="eyebrow">{homepage.hero.eyebrow}</p>
            <h1 id="home-title">{homepage.hero.title}</h1>
            <p className="home-hero__description">{homepage.hero.description}</p>
            <div className="button-row">
              <ButtonLink href="/launch/">{homepage.hero.primaryCta}</ButtonLink>
              <ButtonLink href="/app/?start=sample" variant="secondary">
                {homepage.hero.secondaryCta}
              </ButtonLink>
            </div>
            <p className="trust-line">{homepage.hero.trustLine}</p>
          </div>

          <div className="workspace-preview" aria-label="Example readiness workspace">
            <div className="workspace-preview__top">
              <div>
                <span className="workspace-preview__dot" aria-hidden="true" />
                <strong>Acme Metrics</strong>
              </div>
              <span>Fictional sample</span>
            </div>
            <div className="privacy-pill">
              <span aria-hidden="true">●</span> Private workspace
            </div>
            <div className="preview-result">
              <p>Preliminary result</p>
              <h2>Likely fit with preparation work</h2>
              <span>Reasoning available</span>
            </div>
            <div className="preview-grid">
              <div>
                <span>Report freshness</span>
                <strong>Needs confirmation</strong>
              </div>
              <div>
                <span>Scope alignment</span>
                <strong>1 open decision</strong>
              </div>
            </div>
            <div className="preview-action">
              <span aria-hidden="true">01</span>
              <div>
                <small>Recommended next action</small>
                <strong>Confirm proposed federal scope</strong>
              </div>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        </div>
      </section>

      <section className="problem-section shell" aria-labelledby="problem-title">
        <div>
          <p className="eyebrow">{homepage.problem.eyebrow}</p>
          <h2 id="problem-title">{homepage.problem.title}</h2>
          <p>{homepage.problem.intro}</p>
        </div>
        <ul className="problem-list">
          {homepage.problem.points.map((point, index) => (
            <li key={point}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              {point}
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section home-section--tint" aria-labelledby="outcomes-title">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">What you receive</p>
              <h2 id="outcomes-title">A working record, not another checklist.</h2>
            </div>
            <p>
              Start with a useful fit result, then build the evidence, decisions, and exports your
              team can actually review.
            </p>
          </div>
          <div className="outcome-grid">
            {homepage.outcomes.map((outcome, index) => (
              <article key={outcome.title} className="outcome-card">
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h3>{outcome.title}</h3>
                <p>{outcome.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section shell" aria-labelledby="steps-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 id="steps-title">From report to reviewable plan.</h2>
          </div>
          <p>No setup project. No account provisioning. No infrastructure connection.</p>
        </div>
        <ol className="steps-list">
          {homepage.steps.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="team-section" aria-labelledby="teams-title">
        <div className="shell team-section__grid">
          <div>
            <p className="eyebrow">Designed for compliance teams</p>
            <h2 id="teams-title">Plain language first. Official detail when you need it.</h2>
            <p>
              Class A Bridge is built for the person coordinating the program, with precise handoffs
              for the people who own technical answers.
            </p>
            <ButtonLink href="/product/" variant="secondary">
              Explore the product
            </ButtonLink>
          </div>
          <ul className="team-points">
            {homepage.complianceTeamPoints.map((point) => (
              <li key={point}>
                <span aria-hidden="true">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-section shell privacy-section" aria-labelledby="privacy-title">
        <div className="privacy-illustration" aria-hidden="true">
          <div className="browser-frame">
            <span />
            <div className="file-card">SOC 2</div>
            <div className="browser-lock">⌁</div>
            <p>Processed locally</p>
          </div>
        </div>
        <div>
          <p className="eyebrow">Privacy and open source</p>
          <h2 id="privacy-title">Sensitive work belongs in a boundary you can inspect.</h2>
          <ul className="check-list">
            {homepage.privacyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="button-row">
            <ButtonLink href="/security-and-privacy/" variant="secondary">
              Review security and privacy
            </ButtonLink>
            <ButtonLink href="/open-source/" variant="quiet">
              Explore open source
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="services-banner" aria-labelledby="services-title">
        <div className="shell services-banner__inner">
          <div>
            <p className="eyebrow">Ancilis services</p>
            <h2 id="services-title">
              Get organized with the software. Get judgment where it matters.
            </h2>
            <p>{homepage.serviceMessage}</p>
          </div>
          <div className="button-row">
            <ButtonLink href="/contact/">Request an Ancilis Class A readiness review</ButtonLink>
            <ButtonLink href="/services/" variant="secondary">
              See advisory services
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="home-section shell faq-section" aria-labelledby="faq-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Frequently asked questions</p>
            <h2 id="faq-title">Know the boundary before you begin.</h2>
          </div>
          <a className="text-link" href="/faq/">
            View all questions →
          </a>
        </div>
        <FaqList items={faqItems} />
      </section>

      <section className="final-cta" aria-labelledby="final-cta-title">
        <div className="shell final-cta__inner">
          <div>
            <p className="eyebrow">Start where you are</p>
            <h2 id="final-cta-title">A clear first result is eight answers away.</h2>
          </div>
          <div>
            <p>No account. No SDK. Project data stays in this browser.</p>
            <ButtonLink href="/launch/">Start the free assessment</ButtonLink>
          </div>
        </div>
      </section>

      <JsonLd data={faqStructuredData} />
    </main>
  );
}
