import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import type { CatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";
import type { MarketingTourDetailCtaModel } from "./resolve-marketing-tour-detail-cta";

export type CatalogTourDetailRegisterCtaProps = {
  readonly registration: CatalogTourRegistrationState;
  readonly cta: MarketingTourDetailCtaModel;
  readonly variant: "primary" | "secondary" | "rail" | "sticky";
  readonly assignRegisterAnchor?: boolean;
};

export async function CatalogTourDetailRegisterCta({
  registration,
  cta,
  variant,
  assignRegisterAnchor = false,
}: CatalogTourDetailRegisterCtaProps) {
  const t = await getTranslations("catalog");
  const showViewSelf = cta.primaryKind === "view-self" && cta.primaryHref != null;

  if (registration.isSoldOut && !showViewSelf) {
    return (
      <p data-marketing-catalog-detail-sold-out>
        {t("detail.soldOut")}
      </p>
    );
  }

  if (cta.primaryHref == null || cta.primaryKind == null) {
    return null;
  }

  const primaryLabel =
    cta.primaryKind === "continue"
      ? t("detail.continueRegister")
      : cta.primaryKind === "view-self"
        ? t("detail.viewMyRegistration")
        : t("detail.register");

  const primary =
    cta.primaryKind === "view-self" ? (
      <a href={cta.primaryHref} data-marketing-view-registration>
        {primaryLabel}
      </a>
    ) : (
      <a href={cta.primaryHref} data-marketing-register>
        {primaryLabel}
      </a>
    );

  let secondary: ReactNode = null;
  if (cta.secondaryKind === "sign-in" && cta.secondaryHref != null) {
    secondary = (
      <a href={cta.secondaryHref} data-marketing-tour-sign-in>
        {t("detail.signInToRegister")}
      </a>
    );
  } else if (cta.secondaryKind === "register-another" && cta.secondaryHref != null) {
    secondary = (
      <a
        href={cta.secondaryHref}
        data-marketing-register
        data-marketing-register-another
      >
        {t("detail.registerAnotherGuest")}
      </a>
    );
  }

  const body = (
    <>
      {primary}
      {secondary}
    </>
  );

  switch (variant) {
    case "primary":
      return (
        <div
          data-marketing-catalog-detail-cta-primary
          data-marketing-tour-detail-cta-mode={cta.mode}
          {...(assignRegisterAnchor ? { id: "catalog-detail-register" } : {})}
        >
          {body}
        </div>
      );
    case "secondary":
      return (
        <footer
          data-marketing-catalog-detail-actions
          data-marketing-tour-detail-cta-mode={cta.mode}
        >
          {body}
        </footer>
      );
    case "rail":
      return (
        <div
          data-marketing-catalog-detail-booking-rail-cta
          data-marketing-tour-detail-cta-mode={cta.mode}
        >
          {body}
        </div>
      );
    case "sticky":
      return (
        <div
          data-marketing-catalog-detail-sticky-cta
          data-marketing-tour-detail-cta-mode={cta.mode}
        >
          {body}
        </div>
      );
    default:
      return null;
  }
}
