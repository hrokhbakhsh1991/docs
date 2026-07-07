import { getTranslations } from "next-intl/server";

import type { CatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";

export type CatalogTourDetailRegisterCtaProps = {
  readonly registration: CatalogTourRegistrationState;
  readonly variant: "primary" | "secondary" | "rail";
  readonly assignRegisterAnchor?: boolean;
};

export async function CatalogTourDetailRegisterCta({
  registration,
  variant,
  assignRegisterAnchor = false,
}: CatalogTourDetailRegisterCtaProps) {
  const t = await getTranslations("catalog");

  if (registration.isSoldOut) {
    return (
      <p data-marketing-catalog-detail-sold-out>
        {t("detail.soldOut")}
      </p>
    );
  }

  if (!registration.canRegister || registration.registrationUrl == null) {
    return null;
  }

  const registerLabel = t("detail.register");
  const link = (
    <a href={registration.registrationUrl} data-marketing-register>
      {registerLabel}
    </a>
  );

  switch (variant) {
    case "primary":
      return (
        <div
          data-marketing-catalog-detail-cta-primary
          {...(assignRegisterAnchor ? { id: "catalog-detail-register" } : {})}
        >
          {link}
        </div>
      );
    case "secondary":
      return <footer data-marketing-catalog-detail-actions>{link}</footer>;
    case "rail":
      return <div data-marketing-catalog-detail-booking-rail-cta>{link}</div>;
    default:
      return null;
  }
}
