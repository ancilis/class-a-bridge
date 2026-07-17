import type { Metadata } from "next";

import { ContactForm } from "../../components/contact-form";
import { PageTemplate } from "../../components/page-template";
import { createPageMetadata } from "../../content/metadata";
import { requirePage } from "../../content/pages";

const page = requirePage("/contact/");

export const metadata: Metadata = createPageMetadata(page);

export default function ContactPage() {
  const configuredEndpoint = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;
  const endpoint = configuredEndpoint?.startsWith("/") ? configuredEndpoint : undefined;

  return (
    <PageTemplate page={page}>
      <section className="contact-section shell" aria-labelledby="contact-form-title">
        <div className="content-section__heading">
          <p className="eyebrow">Contact-only intake</p>
          <h2 id="contact-form-title">Tell us where judgment would help.</h2>
          <p>
            Fields marked by validation are required before a configured endpoint can receive the
            request.
          </p>
        </div>
        <ContactForm endpoint={endpoint} />
      </section>
    </PageTemplate>
  );
}
