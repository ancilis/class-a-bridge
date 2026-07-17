export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly emphasis?: boolean;
}

export interface FooterGroup {
  readonly title: string;
  readonly links: readonly NavItem[];
}

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface GlossaryTerm {
  readonly term: string;
  readonly definition: string;
}

export interface ContentCard {
  readonly title: string;
  readonly body: string;
  readonly href?: string;
  readonly linkLabel?: string;
}

export interface ContentSection {
  readonly id: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly body?: readonly string[];
  readonly bullets?: readonly string[];
  readonly cards?: readonly ContentCard[];
  readonly note?: string;
}

export interface PageCta {
  readonly title: string;
  readonly body: string;
  readonly primaryLabel: string;
  readonly primaryHref: string;
  readonly secondaryLabel?: string;
  readonly secondaryHref?: string;
}

export interface StaticPageDefinition {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly headline: string;
  readonly intro: string;
  readonly sections: readonly ContentSection[];
  readonly cta?: PageCta;
}
