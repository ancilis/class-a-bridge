"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  createContactPayload,
  focusContactErrorSummary,
  validateContactFields,
  type ContactErrors,
  type ContactFields,
} from "./contact-model";

const initialFields: ContactFields = {
  name: "",
  email: "",
  company: "",
  role: "",
  message: "",
  includeSummary: false,
  approvedSummary: "",
  website: "",
};

interface ContactFormProps {
  readonly endpoint: string | undefined;
}

export function ContactForm({ endpoint }: ContactFormProps) {
  const [fields, setFields] = useState<ContactFields>(initialFields);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const errorSummary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusContactErrorSummary(errors, errorSummary.current);
  }, [errors]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateContactFields(fields);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (fields.website) {
      setStatus("sent");
      return;
    }

    if (!endpoint) {
      setStatus("error");
      return;
    }

    setStatus("sending");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createContactPayload(fields)),
      });

      if (!response.ok) throw new Error("Contact request was not accepted");
      setFields(initialFields);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="contact-panel">
      {!endpoint ? (
        <div className="contact-fallback" role="note">
          <strong>A contact endpoint is not configured on this deployment.</strong>
          <p>
            You can still email <a href="mailto:hello@ancilis.com">hello@ancilis.com</a>. Do not
            attach assessment documents to the initial message.
          </p>
        </div>
      ) : null}

      {Object.keys(errors).length > 0 ? (
        <div className="error-summary" ref={errorSummary} tabIndex={-1} role="alert">
          <h2>Check the highlighted fields</h2>
          <ul>
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <a href={`#contact-${field}`}>{message}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className="contact-form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        noValidate
      >
        <div className="form-grid">
          <div className="field">
            <label htmlFor="contact-name">Name</label>
            <input
              id="contact-name"
              name="name"
              autoComplete="name"
              value={fields.name}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "contact-name-error" : undefined}
              onChange={(event) => setFields({ ...fields, name: event.target.value })}
            />
            {errors.name ? (
              <span id="contact-name-error" className="field-error">
                {errors.name}
              </span>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="contact-email">Work email</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              value={fields.email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "contact-email-error" : undefined}
              onChange={(event) => setFields({ ...fields, email: event.target.value })}
            />
            {errors.email ? (
              <span id="contact-email-error" className="field-error">
                {errors.email}
              </span>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="contact-company">Company</label>
            <input
              id="contact-company"
              name="company"
              autoComplete="organization"
              value={fields.company}
              onChange={(event) => setFields({ ...fields, company: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="contact-role">Role</label>
            <input
              id="contact-role"
              name="role"
              autoComplete="organization-title"
              value={fields.role}
              onChange={(event) => setFields({ ...fields, role: event.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="contact-message">What review or decision do you need?</label>
          <textarea
            id="contact-message"
            name="message"
            rows={5}
            value={fields.message}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={
              errors.message ? "contact-message-help contact-message-error" : "contact-message-help"
            }
            onChange={(event) => setFields({ ...fields, message: event.target.value })}
          />
          <span id="contact-message-help" className="field-help">
            Keep this high level. Do not paste report text, evidence, credentials, or incident
            details.
          </span>
          {errors.message ? (
            <span id="contact-message-error" className="field-error">
              {errors.message}
            </span>
          ) : null}
        </div>

        <div className="summary-consent">
          <label>
            <input
              name="includeSummary"
              type="checkbox"
              checked={fields.includeSummary}
              onChange={(event) => setFields({ ...fields, includeSummary: event.target.checked })}
            />
            <span>
              <strong>Include a summary I approve</strong>
              <small>This is entered here manually. The website cannot read your project.</small>
            </span>
          </label>
          {fields.includeSummary ? (
            <div className="field">
              <label htmlFor="contact-approvedSummary">Approved summary</label>
              <textarea
                id="contact-approvedSummary"
                name="approvedSummary"
                rows={4}
                value={fields.approvedSummary}
                aria-invalid={Boolean(errors.approvedSummary)}
                aria-describedby={
                  errors.approvedSummary ? "contact-approvedSummary-error" : undefined
                }
                onChange={(event) => setFields({ ...fields, approvedSummary: event.target.value })}
              />
              {errors.approvedSummary ? (
                <span id="contact-approvedSummary-error" className="field-error">
                  {errors.approvedSummary}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="honeypot" aria-hidden="true">
          <label htmlFor="contact-website">Website</label>
          <input
            id="contact-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={fields.website}
            onChange={(event) => setFields({ ...fields, website: event.target.value })}
          />
        </div>

        <div className="form-actions">
          <button
            className="button button--primary"
            type="submit"
            disabled={status === "sending" || !endpoint}
          >
            {status === "sending" ? "Sending…" : "Request readiness review"}
          </button>
          <p>
            This form sends contact fields only. No report, evidence, answers, or attachment is
            included.
          </p>
        </div>
      </form>

      <div className="form-status" aria-live="polite">
        {status === "sent" ? (
          <p>Request received. Ancilis can follow up using the contact details you provided.</p>
        ) : null}
        {status === "error" ? (
          <p>
            The request was not sent. Try again later or email{" "}
            <a href="mailto:hello@ancilis.com">hello@ancilis.com</a> without attachments.
          </p>
        ) : null}
      </div>
    </div>
  );
}
