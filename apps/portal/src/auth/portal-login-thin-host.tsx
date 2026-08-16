"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { completeMemberLoginEgress } from "@app-tour/catalog-registration-flow-ui";

import type { PortalLoginModalFlowInput } from "@/auth/portal-login-modal";
import { PublicCatalogRegistrationFlow } from "@/catalog/public-catalog-registration-flow";

type Props = {
  readonly flow: PortalLoginModalFlowInput;
  readonly portalReturn: string;
};

/**
 * DL-48 — `/login` page host. Phone / OTP / profile run on the page.
 * Register-route modal is unchanged (PCMS-UX-MODAL-04).
 */
export function PortalLoginThinHost({ flow, portalReturn }: Props) {
  const t = useTranslations("catalogRegistration");

  const onAuthenticated = useCallback(() => {
    completeMemberLoginEgress({ memberLoginEgress: true });
  }, []);

  return (
    <div data-portal-login-page-shell="" data-portal-return={portalReturn}>
      <section data-portal-login-story-panel="">
        <div data-portal-login-story-copy>
          <p data-portal-login-story-eyebrow>{t("phone.formEyebrow")}</p>
          <h2 data-portal-login-story-title>{t("phone.portalStoryTitle")}</h2>
          <p data-portal-login-story-description>{t("phone.portalStoryDescription")}</p>
        </div>
        <ul data-portal-login-story-highlights>
          <li data-portal-login-story-highlight="">
            <strong>{t("phone.portalHighlightOne")}</strong>
            <span> {t("phone.portalHighlightOneCaption")}</span>
          </li>
          <li data-portal-login-story-highlight="">
            <strong>{t("phone.portalHighlightTwo")}</strong>
            <span> {t("phone.portalHighlightTwoCaption")}</span>
          </li>
        </ul>
      </section>
      <section data-portal-login-form-panel="">
        <header data-portal-login-form-panel-header>
          <p data-portal-login-form-panel-eyebrow>{t("phone.loginTitle")}</p>
          <p data-portal-login-form-panel-description>{t("phone.loginDescription")}</p>
        </header>
        <PublicCatalogRegistrationFlow
          workspace={flow.workspace}
          tenantId={flow.tenantId}
          tourId={flow.tourId}
          tourTitle={flow.tourTitle}
          tourPoliciesText={null}
          tourPriceAmount={null}
          tourNationalIdRequired={false}
          tourFatherNameRequired={false}
          tourBirthDateRequired={false}
          backHref={flow.backHref}
          memberModuleHref={flow.memberModuleHref}
          memberLoginEgress
          onAuthenticated={onAuthenticated}
        />
      </section>
    </div>
  );
}
