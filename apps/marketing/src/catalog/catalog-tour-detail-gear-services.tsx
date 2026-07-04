import { getTranslations } from "next-intl/server";

import type { MarketingCatalogCard } from "./catalog-types";

export type CatalogTourDetailGearServicesProps = {
  readonly tour: MarketingCatalogCard;
};

export async function CatalogTourDetailGearServices({ tour }: CatalogTourDetailGearServicesProps) {
  const t = await getTranslations("catalog");
  const gearItems = tour.gearItems ?? [];
  const included = tour.includedServices ?? [];
  const excluded = tour.excludedServices ?? [];
  const hasGear = gearItems.length > 0;
  const hasServices = included.length > 0 || excluded.length > 0 || tour.includesTourInsurance === true;

  if (!hasGear && !hasServices) {
    return null;
  }

  return (
    <>
      {hasGear ? (
        <section data-marketing-catalog-detail-gear id="catalog-detail-gear">
          <h2>{t("detail.gear.heading")}</h2>
          <ul data-marketing-catalog-detail-gear-list>
            {gearItems.map((item) => (
              <li
                key={`${item.name}-${item.isRequired ? "required" : "optional"}`}
                data-marketing-catalog-detail-gear-required={item.isRequired ? true : undefined}
              >
                <span>{item.name}</span>
                <span>{item.isRequired ? t("detail.gear.required") : t("detail.gear.optional")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasServices ? (
        <section data-marketing-catalog-detail-services id="catalog-detail-services">
          <h2>{t("detail.services.heading")}</h2>
          {included.length > 0 ? (
            <div data-marketing-catalog-detail-included>
              <h3>{t("detail.services.included")}</h3>
              <ul>
                {included.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {excluded.length > 0 ? (
            <div data-marketing-catalog-detail-excluded>
              <h3>{t("detail.services.excluded")}</h3>
              <ul>
                {excluded.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {tour.includesTourInsurance === true ? (
            <p data-marketing-catalog-detail-tour-insurance>{t("detail.services.insuranceIncluded")}</p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
