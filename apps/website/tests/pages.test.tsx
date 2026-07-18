import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "../app/page";
import FaqPage from "../app/faq/page";
import LaunchPage from "../app/launch/page";
import GuidancePage from "../app/guidance/page";

describe("key marketing pages", () => {
  it("renders every required homepage section and both hero actions", () => {
    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain("Turn your SOC 2 Type II into a clear FedRAMP Class A plan.");
    expect(markup).toContain("Start the free assessment");
    expect(markup).toContain("Explore the sample workspace");
    expect(markup).toContain("A SOC 2 reuse accelerator—not a universal crosswalk.");
    expect(markup).toContain("Your team confirms every mapping");
    expect(markup).toContain("What you receive");
    expect(markup).toContain("How it works");
    expect(markup).toContain("Designed for compliance teams");
    expect(markup).toContain("Privacy and open source");
    expect(markup).toContain("Ancilis services");
    expect(markup).toContain("Frequently asked questions");
  });

  it("renders the complete FAQ on its dedicated page", () => {
    const markup = renderToStaticMarkup(<FaqPage />);

    expect(markup.match(/<details/g)).toHaveLength(12);
    expect(markup).toContain("Can it submit our application?");
    expect(markup).toContain("Does it use a universal SOC 2-to-FedRAMP crosswalk?");
  });

  it("presents exactly three application starting paths", () => {
    const markup = renderToStaticMarkup(<LaunchPage />);

    expect(markup).toContain("Start with my SOC 2 report");
    expect(markup).toContain("Start without uploading a report");
    expect(markup).toContain("Explore a fictional sample workspace");
    expect(markup.match(/href="\/app\/\?start=/g)).toHaveLength(3);
  });

  it("renders all fourteen glossary terms in the guidance", () => {
    const markup = renderToStaticMarkup(<GuidancePage />);

    expect(markup.match(/<dt/g)).toHaveLength(14);
    expect(markup).toContain("Cloud service offering");
    expect(markup).toContain("Bridge letter");
  });
});
