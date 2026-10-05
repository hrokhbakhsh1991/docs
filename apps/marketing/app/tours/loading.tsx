import { getTranslations } from "next-intl/server";

export default async function MarketingToursLoading() {
  const t = await getTranslations("catalog");

  return (
    <div
      data-marketing-catalog-loading-grid
      aria-busy="true"
      aria-live="polite"
      aria-label={t("loading.label")}
    >
      <p>{t("loading.label")}</p>
      <div aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} data-marketing-catalog-loading-card />
        ))}
      </div>
    </div>
  );
}
