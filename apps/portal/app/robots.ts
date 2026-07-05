import type { MetadataRoute } from "next";

/** DL-39 — portal crawl boundary: member + registration paths are noindex via page metadata; disallow BFF. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/api/"],
    },
  };
}
