import { getTranslations } from "next-intl/server";

import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";

export type PortalRegistrationChromeProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly backHref: string;
  readonly memberLoginEgress?: boolean;
};

/** PS-VIS-1 — minimal registration shell (DL-01): brand bar + back, no bottom nav. */
export async function PortalRegistrationChrome({
  branding,
  backHref,
  memberLoginEgress = false,
}: PortalRegistrationChromeProps) {
  const t = await getTranslations("catalogRegistration");
  const workspaceLabel = resolveGuestChromeDisplayName(
    branding.displayName,
    t("chrome.defaultSiteName")
  );

  return (
    <header
      data-portal-registration-chrome
      data-slot="registration-chrome"
      {...(memberLoginEgress ? { "data-member-login-egress": "" } : {})}
    >
      <a href={backHref} data-portal-registration-back>
        {memberLoginEgress ? t("backToMarketing") : t("backToTour")}
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
