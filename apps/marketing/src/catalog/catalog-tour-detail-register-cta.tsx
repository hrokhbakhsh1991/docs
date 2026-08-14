"use client";

import { useTranslations } from "next-intl";
import type { CatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";

export type CatalogTourDetailRegisterCtaProps = {
  readonly registration: CatalogTourRegistrationState;
  readonly variant: "primary" | "secondary" | "rail";
  readonly assignRegisterAnchor?: boolean;
  readonly tourSignInUrl?: string | null;
  readonly embeddedRegistrationUrl?: string | null;
  readonly embeddedTourSignInUrl?: string | null;
};

export function CatalogTourDetailRegisterCta({
  registration,
  variant,
  assignRegisterAnchor = false,
  tourSignInUrl = null,
  embeddedRegistrationUrl = null,
  embeddedTourSignInUrl = null,
}: CatalogTourDetailRegisterCtaProps) {
  const t = useTranslations("catalog");

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

  const signInLink =
    tourSignInUrl != null && tourSignInUrl.trim().length > 0 ? (
      <a
        href={tourSignInUrl}
        data-marketing-tour-sign-in
        {...(embeddedTourSignInUrl != null && embeddedTourSignInUrl.trim().length > 0
          ? {
              "data-marketing-dialog-src": embeddedTourSignInUrl,
              "data-marketing-dialog-title": t("detail.registrationDialog.signInTitle"),
            }
          : {})}
      >
        {t("detail.signInToRegister")}
      </a>
    ) : null;

  const link = (
    <a
      href={registration.registrationUrl}
      data-marketing-register
      {...(embeddedRegistrationUrl != null && embeddedRegistrationUrl.trim().length > 0
        ? {
            "data-marketing-dialog-src": embeddedRegistrationUrl,
            "data-marketing-dialog-title": t("detail.registrationDialog.registerTitle"),
          }
        : {})}
    >
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
          {signInLink}
        </div>
      );
    case "secondary":
      return (
        <footer data-marketing-catalog-detail-actions>
          {link}
          {signInLink}
        </footer>
      );
    case "rail":
      return (
        <div data-marketing-catalog-detail-booking-rail-cta>
          {link}
          {signInLink}
        </div>
      );
    default:
      return null;
  }
}
