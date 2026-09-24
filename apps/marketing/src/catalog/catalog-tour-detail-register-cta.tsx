import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { MarketingLoginModalTrigger } from "@/auth/marketing-login-modal-trigger";
import { isAppLocale, resolveMarketingTourDetailAuthModalHref, routing } from "@/i18n/routing";
import type { CatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";
import type { MarketingTourDetailCtaModel } from "./resolve-marketing-tour-detail-cta";

export type CatalogTourDetailRegisterCtaProps = {
  readonly registration: CatalogTourRegistrationState;
  readonly cta: MarketingTourDetailCtaModel;
  readonly variant: "primary" | "secondary" | "rail" | "sticky";
  readonly assignRegisterAnchor?: boolean;
  readonly tourId?: string;
  readonly tourTitle?: string;
};

export async function CatalogTourDetailRegisterCta({
  registration,
  cta,
  variant,
  assignRegisterAnchor = false,
  tourId,
  tourTitle,
}: CatalogTourDetailRegisterCtaProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const pdpAuthModalHref =
    tourId != null && tourId.trim().length > 0
      ? resolveMarketingTourDetailAuthModalHref(tourId, locale)
      : null;
  const showViewSelf = cta.primaryKind === "view-self" && cta.primaryHref != null;

  if (registration.state === "past" && !showViewSelf) {
    return <p data-marketing-catalog-detail-past>{t("detail.past")}</p>;
  }

  if (registration.state === "closed" && !showViewSelf) {
    return <p data-marketing-catalog-detail-sold-out>{t("detail.soldOut")}</p>;
  }

  if (cta.primaryHref == null || cta.primaryKind == null) {
    return null;
  }

  const primaryLabel =
    cta.primaryKind === "continue"
      ? t("detail.continueRegister")
      : cta.primaryKind === "view-self"
        ? t("detail.viewMyRegistration")
        : cta.primaryKind === "waitlist"
          ? t("detail.joinWaitlist")
          : t("detail.register");

  const primary =
    cta.primaryKind === "view-self" ? (
      <a href={cta.primaryHref} data-marketing-view-registration>
        {primaryLabel}
      </a>
    ) : cta.primaryKind === "register" && pdpAuthModalHref !== null ? (
      <MarketingLoginModalTrigger
        href={pdpAuthModalHref}
        host="pdp"
        tourId={tourId}
        tourTitle={tourTitle}
        data-marketing-register
        data-marketing-cta-action="register"
      >
        {primaryLabel}
      </MarketingLoginModalTrigger>
    ) : cta.primaryKind === "waitlist" && pdpAuthModalHref !== null ? (
      <MarketingLoginModalTrigger
        href={pdpAuthModalHref}
        host="pdp"
        tourId={tourId}
        tourTitle={tourTitle}
        data-marketing-register
        data-marketing-cta-action="waitlist"
      >
        {primaryLabel}
      </MarketingLoginModalTrigger>
    ) : (
      <a href={cta.primaryHref} data-marketing-register>
        {primaryLabel}
      </a>
    );

  let secondary: ReactNode = null;
  if (cta.secondaryKind === "sign-in" && pdpAuthModalHref !== null) {
    secondary = (
      <MarketingLoginModalTrigger
        href={pdpAuthModalHref}
        host="pdp"
        tourId={tourId}
        tourTitle={tourTitle}
        data-marketing-tour-sign-in
        data-marketing-cta-action="sign-in"
      >
        {t("detail.signInToRegister")}
      </MarketingLoginModalTrigger>
    );
  } else if (cta.secondaryKind === "register-another" && cta.secondaryHref != null) {
    secondary = (
      <a
        href={cta.secondaryHref}
        data-marketing-register
        data-marketing-register-another
        data-marketing-cta-action="register-another"
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
          data-marketing-cta-surface="primary"
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
          data-marketing-cta-surface="secondary"
          data-marketing-tour-detail-cta-mode={cta.mode}
        >
          {body}
        </footer>
      );
    case "rail":
      return (
        <div
          data-marketing-catalog-detail-booking-rail-cta
          data-marketing-cta-surface="rail"
          data-marketing-tour-detail-cta-mode={cta.mode}
        >
          {body}
        </div>
      );
    case "sticky":
      return (
        <div
          data-marketing-catalog-detail-sticky-cta
          data-marketing-cta-surface="sticky"
          data-marketing-tour-detail-cta-mode={cta.mode}
        >
          {body}
        </div>
      );
    default:
      return null;
  }
}
