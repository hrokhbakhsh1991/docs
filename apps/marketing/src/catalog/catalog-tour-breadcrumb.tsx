import Link from "next/link";

import { resolveMarketingLocalePath, type AppLocale } from "@/i18n/routing";

export type CatalogTourBreadcrumbProps = {
  readonly locale: AppLocale;
  readonly homeLabel: string;
  readonly toursLabel: string;
  readonly tourTitle: string;
};

export function CatalogTourBreadcrumb({
  locale,
  homeLabel,
  toursLabel,
  tourTitle,
}: CatalogTourBreadcrumbProps) {
  const homeHref = resolveMarketingLocalePath("/", locale);
  const toursHref = resolveMarketingLocalePath("/tours", locale);

  return (
    <nav aria-label="Breadcrumb" data-marketing-catalog-breadcrumb-nav>
      <ol data-marketing-catalog-breadcrumb-list>
        <li>
          <Link href={homeHref} data-marketing-catalog-breadcrumb-home>
            {homeLabel}
          </Link>
        </li>
        <li>
          <Link href={toursHref} data-marketing-catalog-breadcrumb-tours>
            {toursLabel}
          </Link>
        </li>
        <li aria-current="page" data-marketing-catalog-breadcrumb-current>
          {tourTitle}
        </li>
      </ol>
    </nav>
  );
}
