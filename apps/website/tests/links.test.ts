import { describe, expect, it } from "vitest";

import { collectInternalLinks } from "../content/link-check";
import { allStaticPages, requiredRoutePaths } from "../content/pages";
import { footerGroups, siteNavigation } from "../content/site-content";

describe("internal navigation", () => {
  it("only targets declared release routes, including the assembled application", () => {
    const declared = new Set([
      "/",
      ...requiredRoutePaths,
      "/app/",
      "/downloads/class-a-bridge-1.0.0-source.tar.gz",
    ]);
    const links = collectInternalLinks({
      pages: allStaticPages,
      navigation: siteNavigation,
      footerGroups,
    });

    for (const href of links) {
      const pathname = new URL(href, "https://classabridge.ancilis.com").pathname;
      expect(declared.has(pathname), `Undeclared internal link: ${href}`).toBe(true);
    }
  });

  it("keeps assessment links on the application boundary", () => {
    const assessmentLink = siteNavigation.find((item) => item.label === "Start assessment");

    expect(assessmentLink?.href).toBe("/launch/");
    expect(assessmentLink?.emphasis).toBe(true);
  });
});
