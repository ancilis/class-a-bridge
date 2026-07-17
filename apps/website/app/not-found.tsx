import { ButtonLink } from "../components/button-link";

export default function NotFound() {
  return (
    <main id="main-content">
      <section className="page-hero">
        <div className="shell page-hero__inner">
          <p className="eyebrow">Page not found</p>
          <h1>This page is outside the current scope.</h1>
          <p className="page-hero__intro">
            The address may have changed. Return to the product overview or start the browser
            assessment.
          </p>
          <div className="button-row">
            <ButtonLink href="/">Return home</ButtonLink>
            <ButtonLink href="/launch/" variant="secondary">
              Start assessment
            </ButtonLink>
          </div>
        </div>
      </section>
    </main>
  );
}
