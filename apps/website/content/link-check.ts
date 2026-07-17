import type { FooterGroup, NavItem, StaticPageDefinition } from "./types";

interface SiteLinkSources {
  readonly pages: readonly StaticPageDefinition[];
  readonly navigation: readonly NavItem[];
  readonly footerGroups: readonly FooterGroup[];
}

export function collectInternalLinks({
  pages,
  navigation,
  footerGroups,
}: SiteLinkSources): ReadonlySet<string> {
  const links = new Set<string>();

  for (const item of navigation) links.add(item.href);
  for (const group of footerGroups) {
    for (const item of group.links) links.add(item.href);
  }
  for (const page of pages) {
    if (page.cta) {
      links.add(page.cta.primaryHref);
      if (page.cta.secondaryHref) links.add(page.cta.secondaryHref);
    }
    for (const section of page.sections) {
      for (const card of section.cards ?? []) {
        if (card.href?.startsWith("/")) links.add(card.href);
      }
    }
  }

  return links;
}
