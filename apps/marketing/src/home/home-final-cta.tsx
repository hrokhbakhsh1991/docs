import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function HomeFinalCta() {
  const t = await getTranslations("catalog");

  return (
    <section data-marketing-home-final-cta>
      <div data-marketing-home-final-cta-body>
        <h2>{t("home.full.finalCta.title")}</h2>
        <p data-marketing-home-final-cta-lead>{t("home.full.finalCta.lead")}</p>
        <Link href="/tours" data-marketing-home-cta>
          {t("home.full.finalCta.cta")}
        </Link>
      </div>
    </section>
  );
}
