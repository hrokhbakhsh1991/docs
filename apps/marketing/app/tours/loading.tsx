import { getTranslations } from "next-intl/server";

/** Accessible loading surface for catalog navigations while the server list resolves. */
export default async function MarketingToursLoading() {
  const t = await getTranslations("catalog");

  return (
    <section
      aria-busy="true"
      aria-live="polite"
      data-marketing-catalog-loading
      data-marketing-catalog-loading-grid
    >
      <p>{t("loading.label")}</p>
      <div>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} aria-hidden="true" data-marketing-catalog-loading-card />
        ))}
      </div>
    </section>
  );
}
