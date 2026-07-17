import { describe, expect, it } from "vitest";

import { faqItems, glossaryTerms, homepage, siteNavigation } from "../content/site-content";
import { allStaticPages, requiredRoutePaths, requirePage } from "../content/pages";

describe("marketing content", () => {
  it("preserves the approved hero and trust language", () => {
    expect(homepage.hero).toEqual({
      eyebrow: "Open-source FedRAMP 20x preparation",
      title: "Turn your SOC 2 Type II into a clear FedRAMP Class A plan.",
      description:
        "Class A Bridge guides compliance teams through eligibility, scope, evidence, and package preparation. No account, no SDK, and no confidential document upload.",
      primaryCta: "Start the free assessment",
      secondaryCta: "Explore the sample workspace",
      trustLine: "Open source · Local-first · Built for compliance teams",
    });
  });

  it("contains every required top-level navigation destination", () => {
    expect(siteNavigation.map((item) => item.label)).toEqual([
      "Product",
      "How it works",
      "Open source",
      "Security and privacy",
      "Guidance",
      "Ancilis services",
      "Start assessment",
    ]);
  });

  it("answers every required frequently asked question", () => {
    const questions = faqItems.map((item) => item.question);

    expect(questions).toEqual(
      expect.arrayContaining([
        "Does this make us FedRAMP certified?",
        "Does a SOC 2 Type II guarantee Class A eligibility?",
        "Does Ancilis receive our SOC 2 report?",
        "Where is project data stored?",
        "Can we use the tool without uploading a report?",
        "Is the project open source?",
        "Can it submit our application?",
        "Is it only for AI vendors?",
        "Does it support Class B or Class C?",
        "Can Ancilis review the result?",
      ]),
    );
  });

  it("defines the complete plain-language glossary", () => {
    expect(glossaryTerms).toHaveLength(14);
    expect(glossaryTerms.map((term) => term.term)).toEqual(
      expect.arrayContaining([
        "Cloud service offering",
        "Certification package",
        "Class A",
        "Key Security Indicator",
        "Verification",
        "Validation",
        "Independent assessment",
        "Trust center",
        "Ongoing Certification Report",
        "Security Decision Record",
        "Federal customer data",
        "Information resource",
        "Subservice organization",
        "Bridge letter",
      ]),
    );
  });

  it("defines every required static page with unique useful metadata", () => {
    expect(allStaticPages.map((page) => page.path)).toEqual(
      expect.arrayContaining([...requiredRoutePaths]),
    );
    expect(new Set(allStaticPages.map((page) => page.path)).size).toBe(allStaticPages.length);
    expect(new Set(allStaticPages.map((page) => page.title)).size).toBe(allStaticPages.length);

    for (const page of allStaticPages) {
      expect(page.title.length).toBeGreaterThan(8);
      expect(page.description.length).toBeGreaterThan(60);
      expect(page.description.length).toBeLessThanOrEqual(180);
    }
  });

  it("publishes usable open-source, license, issue, and private security links", () => {
    const page = requirePage("/open-source/");
    const links = page.sections.flatMap((section) =>
      (section.cards ?? []).flatMap((card) => (card.href ? [card.href] : [])),
    );

    expect(links).toEqual(
      expect.arrayContaining([
        "/downloads/class-a-bridge-1.0.0-source.tar.gz",
        "https://www.apache.org/licenses/LICENSE-2.0.txt",
        "/contact/",
        "mailto:security@ancilis.ai",
      ]),
    );
  });

  it("states concrete retention windows for contact and abuse data", () => {
    const page = requirePage("/privacy/");
    const copy = JSON.stringify(page);

    expect(copy).toContain("up to 12 months");
    expect(copy).toContain("up to 90 days");
    expect(copy).toContain("deleted sooner when no longer needed");
    expect(copy).not.toContain("A production deployer should publish");
  });

  it("does not use prohibited approval or automation claims", () => {
    const siteCopy = JSON.stringify({ homepage, faqItems, allStaticPages });

    expect(siteCopy).not.toMatch(
      /(?:become|makes? (?:your company|you)|you are) FedRAMP certified/i,
    );
    expect(siteCopy).not.toMatch(/(?:you are|your company is) guaranteed eligible/i);
    expect(siteCopy).not.toMatch(/AI[- ]powered certification/i);
    expect(siteCopy).not.toMatch(/automated replacement for an assessor/i);
  });

  it("returns a definite page or fails at the content boundary", () => {
    expect(requirePage("/product/").path).toBe("/product/");
    expect(() => requirePage("/missing/")).toThrowError(
      "Static page content is missing: /missing/",
    );
  });
});
