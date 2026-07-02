import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { CatalogCoverImage } from "./catalog-cover-image";
import { CatalogTourStats } from "./catalog-tour-stats";
import { buildCatalogTourMetaLine } from "./build-catalog-tour-meta-line";
import type { MarketingCatalogCard } from "./catalog-types";
import { formatCatalogCardDescription } from "./format-catalog-display";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";

export type CatalogTourCardProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
};

export async function CatalogTourCard({ tour, pluginId }: CatalogTourCardProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const detailHref = `/tours/${tour.id}`;
  const title = tour.title?.trim() || t("detail.untitled");
  const description = formatCatalogCardDescription(tour);
  const metaLine = buildCatalogTourMetaLine(tour, dateLocale, t("detail.datesTba"));

  return (
    <article data-marketing-catalog-card>
      {tour.coverImageUrl ? (
        <Link href={detailHref} data-marketing-catalog-card-cover>
          <CatalogCoverImage src={tour.coverImageUrl} alt={title} width={640} height={360} />
        </Link>
      ) : null}
      <div data-marketing-catalog-card-body>
        <h2 data-marketing-catalog-card-title>
          <Link href={detailHref}>{title}</Link>
        </h2>
        {description ? <p data-marketing-catalog-card-description>{description}</p> : null}
        {metaLine ? <p data-marketing-catalog-card-meta>{metaLine}</p> : null}
        <CatalogTourStats tour={tour} testId="card" pluginId={pluginId} />
        <Link href={detailHref} data-marketing-catalog-card-cta>
          {t("list.viewTour")}
        </Link>
      </div>
    </article>
  );
}
