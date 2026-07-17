import type { Metadata } from "next";

import { PageTemplate } from "../../components/page-template";
import { createPageMetadata } from "../../content/metadata";
import { requirePage } from "../../content/pages";

const page = requirePage("/launch/");

export const metadata: Metadata = createPageMetadata(page);

export default function LaunchPage() {
  return <PageTemplate page={page} />;
}
