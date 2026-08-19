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
 * Register-route modal is unchanged (PCMS-UX-MODAL-04) and is the only
 * remaining `PortalLoginModalProvider` host.
 *
 * Alpine Split: photography field + form plane. Auth callbacks unchanged.
 */
export function PortalLoginThinHost({ flow, portalReturn }: Props) {
  const t = useTranslations("catalogRegistration");

  const onAuthenticated = useCallback(() => {
    completeMemberLoginEgress({ memberLoginEgress: true });
  }, []);

  return (
    <div data-portal-login-page-shell="" data-portal-return={portalReturn}>
      <section
        data-portal-login-photo-field=""
        role="img"
        aria-label={t("phone.portalPhotoLabel")}
      />
      <section data-portal-login-form-panel="">
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
