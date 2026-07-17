import type { MetadataRoute } from "next";

import { baseUrl } from "../content/metadata";
import { allStaticPages } from "../content/pages";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-17T00:00:00.000Z");

  return [
    {
      url: `${baseUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...allStaticPages.map((page) => ({
      url: `${baseUrl}${page.path}`,
      lastModified,
      changeFrequency: page.path === "/release-notes/" ? ("monthly" as const) : ("weekly" as const),
      priority: page.path === "/launch/" ? 0.9 : 0.7,
    })),
  ];
}
