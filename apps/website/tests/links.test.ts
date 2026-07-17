import { describe, expect, it } from "vitest";

import { collectInternalLinks } from "../content/link-check";
import { allStaticPages, requiredRoutePaths } from "../content/pages";
import { footerGroups, siteNavigation } from "../content/site-content";

describe("internal navigation", () => {
  it("only targets declared static routes or the separately deployed app", () => {
    const declared = new Set(["/", ...requiredRoutePaths]);
    const links = collectInternalLinks({
      pages: allStaticPages,
      navigation: siteNavigation,
      footerGroups,
    });

    for (const href of links) {
      if (href.startsWith("/app/")) continue;
      expect(declared.has(href), `Undeclared internal link: ${href}`).toBe(true);
    }
  });

  it("keeps assessment links on the application boundary", () => {
    const assessmentLink = siteNavigation.find((item) => item.label === "Start assessment");

    expect(assessmentLink?.href).toBe("/launch/");
    expect(assessmentLink?.emphasis).toBe(true);
  });
});
