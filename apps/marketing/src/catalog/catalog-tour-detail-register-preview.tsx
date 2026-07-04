import { getTranslations } from "next-intl/server";

import { buildCatalogRegisterPreviewItems } from "./build-catalog-register-preview-items";
import type { MarketingCatalogCard } from "./catalog-types";
import { resolveCatalogPaymentModeLabelKey } from "./resolve-catalog-payment-mode-label-key";

export type CatalogTourDetailRegisterPreviewProps = {
  readonly tour: MarketingCatalogCard;
};

export async function CatalogTourDetailRegisterPreview({
  tour,
}: CatalogTourDetailRegisterPreviewProps) {
  const t = await getTranslations("catalog");
  const paymentMode = tour.paymentMode?.trim() ?? "";
  const paymentModeLabelKey =
    paymentMode.length > 0 ? resolveCatalogPaymentModeLabelKey(paymentMode) : null;
  const paymentModeLabel =
    paymentModeLabelKey != null ? t(paymentModeLabelKey) : paymentMode.length > 0 ? paymentMode : null;

  const items = buildCatalogRegisterPreviewItems({
    tour,
    paymentModeLabel,
    labels: {
      nationalId: t("detail.registerPreview.nationalId"),
      fatherName: t("detail.registerPreview.fatherName"),
      birthDate: t("detail.registerPreview.birthDate"),
      minimumAge: (years) => t("detail.registerPreview.minimumAge", { years }),
      maximumAge: (years) => t("detail.registerPreview.maximumAge", { years }),
      transportIntake: t("detail.registerPreview.transportIntake"),
      payment: (modeLabel) => t("detail.registerPreview.payment", { mode: modeLabel }),
    },
  });

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      data-marketing-catalog-detail-register-preview
      id="catalog-detail-register-preview"
    >
      <h2>{t("detail.registerPreview.heading")}</h2>
      <p>{t("detail.registerPreview.lead")}</p>
      <ul data-marketing-catalog-detail-register-preview-list>
        {items.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
    </section>
  );
}
