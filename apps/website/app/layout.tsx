import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

import { JsonLd } from "../components/json-ld";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { baseUrl, organizationStructuredData, softwareStructuredData } from "../content/metadata";
import { siteDescription } from "../content/site-content";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Class A Bridge by Ancilis",
    template: "%s | Class A Bridge by Ancilis",
  },
  description: siteDescription,
  applicationName: "Class A Bridge",
  authors: [{ name: "Ancilis" }],
  creator: "Ancilis",
  publisher: "Ancilis",
  category: "Compliance preparation software",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Class A Bridge by Ancilis",
    title: "Turn your SOC 2 Type II into a clear FedRAMP Class A plan.",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Class A Bridge by Ancilis",
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f7f4",
  colorScheme: "light",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <JsonLd data={organizationStructuredData} />
        <JsonLd data={softwareStructuredData} />
      </body>
    </html>
  );
}
