export interface ContactFields {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly role: string;
  readonly message: string;
  readonly includeSummary: boolean;
  readonly approvedSummary: string;
  readonly website: string;
}

export interface ContactPayload {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly role: string;
  readonly message: string;
  readonly approvedSummary?: string;
}

export type ContactErrors = Partial<Record<keyof ContactFields, string>>;

export function validateContactFields(fields: ContactFields): ContactErrors {
  const errors: ContactErrors = {};

  if (!fields.name.trim()) errors.name = "Enter your name.";
  if (!/^\S+@\S+\.\S+$/.test(fields.email.trim())) {
    errors.email = "Enter a valid work email.";
  }
  if (!fields.message.trim()) {
    errors.message = "Describe the review or decision you need.";
  }
  if (fields.includeSummary && !fields.approvedSummary.trim()) {
    errors.approvedSummary = "Add the summary you approve, or clear the approval checkbox.";
  }

  return errors;
}

export function createContactPayload(fields: ContactFields): ContactPayload {
  const payload: ContactPayload = {
    name: fields.name.trim(),
    email: fields.email.trim(),
    company: fields.company.trim(),
    role: fields.role.trim(),
    message: fields.message.trim(),
  };

  if (fields.includeSummary && fields.approvedSummary.trim()) {
    return { ...payload, approvedSummary: fields.approvedSummary.trim() };
  }

  return payload;
}
