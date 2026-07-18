import { describe, expect, it } from "vitest";

import { faqItems, glossaryTerms, homepage, siteNavigation } from "../content/site-content";
import { allStaticPages, requiredRoutePaths, requirePage } from "../content/pages";

describe("marketing content", () => {
  it("preserves the approved hero and trust language", () => {
    expect(homepage.hero).toEqual({
      eyebrow: "Open-source FedRAMP 20x preparation",
      title: "Turn your SOC 2 Type II into a clear FedRAMP Class A plan.",
      description:
        "See what your existing SOC 2 program may support, identify what is still missing, and prepare a structured FedRAMP 20x Class A workspace. No account, no SDK, and no confidential document upload.",
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
        "Does it use a universal SOC 2-to-FedRAMP crosswalk?",
        "Does it use artificial intelligence to suggest mappings?",
      ]),
    );
  });

  it("positions SOC 2 reuse as deterministic, explainable, local, and human-confirmed", () => {
    const reuseCopy = JSON.stringify({
      homepage,
      product: requirePage("/product/"),
      howItWorks: requirePage("/how-it-works/"),
      methodology: requirePage("/methodology/"),
    }).toLowerCase();

    expect(reuseCopy).toContain("soc 2 reuse accelerator");
    expect(reuseCopy).toContain("deterministic");
    expect(reuseCopy).toContain("explains why");
    expect(reuseCopy).toContain("your team confirms every mapping");
    expect(reuseCopy).toContain("does not apply a universal crosswalk");
    expect(reuseCopy).toContain("runs locally in your browser");
    expect(reuseCopy).toContain("does not use artificial intelligence");
    expect(reuseCopy).toContain("audit period");
    expect(reuseCopy).toContain("test results");
    expect(reuseCopy).toContain("exceptions");
    expect(reuseCopy).toContain("carve-outs");
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
        "/downloads/class-a-bridge-0.9.0-source.tar.gz",
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
    expect(siteCopy).not.toMatch(/AI[- ]powered (?:crosswalk|mapping|compliance)/i);
    expect(siteCopy).not.toMatch(/automated replacement for an assessor/i);
    expect(siteCopy).not.toMatch(
      /automatically (?:satisf(?:y|ies)|cover(?:s|ed)?|complete(?:s|d)?|approve(?:s|d)?)/i,
    );
  });

  it("publishes an honest public-beta designation while human review remains pending", () => {
    const siteCopy = JSON.stringify({ homepage, faqItems, allStaticPages });
    const releaseNotes = requirePage("/release-notes/");

    expect(releaseNotes.headline).toContain("0.9.0 Public Beta");
    expect(siteCopy).not.toContain("Version 1.0");
    expect(siteCopy).not.toContain("Release 1.0");
    expect(siteCopy).not.toContain("complete Class A preparation foundation");
    expect(siteCopy).not.toContain("reviewed mapping playbooks");
  });

  it("uses the approved Ancilis advisory boundary consistently", () => {
    const approvedMessage =
      "Software can organize and accelerate the record. Ancilis can help validate the interpretation, close implementation gaps, and review the package before your company applies.";
    const servicesCopy = JSON.stringify(requirePage("/services/"));

    expect(homepage.serviceMessage).toBe(approvedMessage);
    expect(servicesCopy).toContain("Software can organize and accelerate the record.");
    expect(servicesCopy).toContain(
      "Clicking the call to action never sends the SOC 2 report, evidence, answers, or project records.",
    );
  });

  it("returns a definite page or fails at the content boundary", () => {
    expect(requirePage("/product/").path).toBe("/product/");
    expect(() => requirePage("/missing/")).toThrowError(
      "Static page content is missing: /missing/",
    );
  });
});
