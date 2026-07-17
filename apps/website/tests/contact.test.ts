import { describe, expect, it } from "vitest";

import {
  createContactPayload,
  validateContactFields,
  type ContactFields,
} from "../components/contact-model";

const validFields: ContactFields = {
  name: "Jordan Lee",
  email: "jordan@example.test",
  company: "Example Cloud",
  role: "GRC manager",
  message: "We need a scope review before planning our timeline.",
  includeSummary: false,
  approvedSummary: "",
  website: "",
};

describe("contact-only handoff", () => {
  it("reports field-specific errors without submitting", () => {
    const result = validateContactFields({
      ...validFields,
      name: "",
      email: "not-an-email",
      message: "",
    });

    expect(result).toEqual({
      name: "Enter your name.",
      email: "Enter a valid work email.",
      message: "Describe the review or decision you need.",
    });
  });

  it("excludes an unapproved summary and the honeypot field", () => {
    const payload = createContactPayload({
      ...validFields,
      approvedSummary: "Potential scope mismatch in the local project.",
      website: "bot-value",
    });

    expect(payload).toEqual({
      name: validFields.name,
      email: validFields.email,
      company: validFields.company,
      role: validFields.role,
      message: validFields.message,
    });
    expect(payload).not.toHaveProperty("website");
  });

  it("includes only a summary the user explicitly approves", () => {
    const payload = createContactPayload({
      ...validFields,
      includeSummary: true,
      approvedSummary: "We have five records marked needs expert review.",
    });

    expect(payload.approvedSummary).toBe("We have five records marked needs expert review.");
  });
});
