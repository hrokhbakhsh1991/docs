import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { isAppLocale, resolveMarketingToursListPath, type AppLocale } from "@/i18n/routing";

export async function HomeFinalCta() {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const toursHref = resolveMarketingToursListPath(locale);

  return (
    <section data-marketing-home-final-cta>
      <div data-marketing-home-final-cta-body>
        <h2>{t("home.full.finalCta.title")}</h2>
        <p data-marketing-home-final-cta-lead>{t("home.full.finalCta.lead")}</p>
        <Link href={toursHref} data-marketing-home-cta>
          {t("home.full.finalCta.cta")}
        </Link>
      </div>
    </section>
  );
}
