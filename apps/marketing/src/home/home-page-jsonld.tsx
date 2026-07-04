import { getTranslations } from "next-intl/server";

import {
  buildMarketingHomeJsonLd,
  type MarketingHomeJsonLdItem,
} from "@/seo/build-marketing-home-jsonld";
import { serializeMarketingJsonLd } from "@/seo/serialize-marketing-jsonld";

export type HomePageJsonLdProps = {
  readonly host: string;
  readonly items: readonly MarketingHomeJsonLdItem[];
};

export async function HomePageJsonLd({ host, items }: HomePageJsonLdProps) {
  const t = await getTranslations("catalog");
  const jsonLd = buildMarketingHomeJsonLd({
    host,
    listLabel: t("home.full.latest.title"),
    items,
  });

  if (jsonLd == null) {
    return null;
  }

  return (
    <script
      type="application/ld+json"
      data-marketing-home-jsonld
      dangerouslySetInnerHTML={{ __html: serializeMarketingJsonLd(jsonLd) }}
    />
  );
}
