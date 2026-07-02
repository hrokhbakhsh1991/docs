import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { isAppLocale, resolveMarketingLocalePath, routing } from "@/i18n/routing";
import { buildPlatformAdminUrl } from "@/platform/build-platform-admin-url";
import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";
import { buildMarketingSiteMetadata } from "@/seo/build-marketing-metadata";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";

export async function generateMetadata(): Promise<Metadata> {
  const [headerList, localeRaw] = await Promise.all([headers(), getLocale()]);
  const host = headerList.get("host") ?? "localhost:3002";
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;

  if (isPlatformMotherHost(host)) {
    return { title: "Platform" };
  }

  const branding = await fetchPublicTenantBrandingForHost(host);
  const t = await getTranslations("catalog");
  const siteName = branding.displayName ?? t("nav.defaultSiteName");
  const homeT = await getTranslations("catalog.home");

  return {
    ...buildMarketingSiteMetadata({
      host,
      siteName,
      toursLabel: t("nav.tours"),
      locale,
    }),
    title: homeT("title"),
    description: homeT("lead"),
    alternates: {
      canonical: resolveMarketingLocalePath("/", locale),
    },
  };
}

export default async function MarketingHomePage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";

  if (isPlatformMotherHost(host)) {
    return (
      <main data-platform-mother-home className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-semibold">پلتفرم مدیریت باشگاه کوهنوردی</h1>
        <a
          href={buildPlatformAdminUrl()}
          data-platform-admin-cta
          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          ورود PlatformOps
        </a>
      </main>
    );
  }

  const t = await getTranslations("catalog.home");

  return (
    <main data-marketing-home>
      <header data-marketing-home-header>
        <h1 data-marketing-home-title>{t("title")}</h1>
        <p data-marketing-home-lead>{t("lead")}</p>
      </header>
      <Link href="/tours" data-marketing-home-cta>
        {t("browseTours")}
      </Link>
    </main>
  );
}
