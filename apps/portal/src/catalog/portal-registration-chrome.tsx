import { getTranslations } from "next-intl/server";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";

export type PortalRegistrationChromeProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly backHref: string;
};

/** PS-VIS-1 — minimal registration shell (DL-01): brand bar + back, no bottom nav. */
export async function PortalRegistrationChrome({
  branding,
  backHref,
}: PortalRegistrationChromeProps) {
  const t = await getTranslations("catalogRegistration");
  const workspaceLabel = branding.displayName?.trim() || "Portal";

  return (
    <header data-portal-registration-chrome data-slot="registration-chrome">
      <a href={backHref} data-portal-registration-back>
        {t("backToTour")}
      </a>
      <div data-portal-registration-brand>
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt=""
            data-portal-registration-logo
            height={32}
            width={32}
          />
        ) : null}
        <span data-portal-registration-workspace-label>{workspaceLabel}</span>
      </div>
    </header>
  );
}
