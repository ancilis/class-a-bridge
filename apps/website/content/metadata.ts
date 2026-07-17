import type { Metadata } from "next";

import type { StaticPageDefinition } from "./types";
import { faqItems, siteDescription } from "./site-content";

export const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://classabridge.ancilis.com";

export function createPageMetadata(page: StaticPageDefinition): Metadata {
  const canonical = `${baseUrl}${page.path}`;

  return {
    title: `${page.title} | Class A Bridge by Ancilis`,
    description: page.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: "Class A Bridge by Ancilis",
      title: page.title,
      description: page.description,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
    },
  };
}

export const organizationStructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Ancilis",
  url: baseUrl,
} as const;

export const softwareStructuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Class A Bridge by Ancilis",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Modern web browser",
  description: siteDescription,
  softwareVersion: "1.0.0",
  isAccessibleForFree: true,
  license: "https://www.apache.org/licenses/LICENSE-2.0",
  featureList: [
    "Preliminary FedRAMP 20x Class A fit assessment",
    "SOC 2 to Class A mapping workspace",
    "Local evidence and action planning",
    "Class A preparation package scaffold",
    "Browser-based JSON validation",
  ],
} as const;

export const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
} as const;

export function serializeStructuredData(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
