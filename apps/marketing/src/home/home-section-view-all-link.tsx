import Link from "next/link";
import { getLocale } from "next-intl/server";
import type { ComponentProps } from "react";

import { isAppLocale, resolveMarketingToursListPath, routing, type AppLocale } from "@/i18n/routing";

export type HomeSectionViewAllLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  readonly href?: string;
};

/** Shared pill control for section headers linking to the locale-aware tours list (PR-25 / M9). */
export async function HomeSectionViewAllLink({ href, ...props }: HomeSectionViewAllLinkProps) {
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const resolvedHref = href ?? resolveMarketingToursListPath(locale);

  return <Link href={resolvedHref} data-marketing-home-section-view-all {...props} />;
}
