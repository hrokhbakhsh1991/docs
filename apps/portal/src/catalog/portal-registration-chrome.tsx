import { Mountain } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";

export type PortalRegistrationChromeProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly backHref: string;
  readonly memberLoginEgress?: boolean;
  readonly registrationIntakeResume?: boolean;
};

function RegistrationBackIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-portal-registration-back-icon
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** PS-VIS-1 — minimal registration shell (DL-01): brand bar + back, no bottom nav. */
export async function PortalRegistrationChrome({
  branding,
  backHref,
  memberLoginEgress = false,
  registrationIntakeResume = false,
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
      {...(registrationIntakeResume ? { "data-portal-registration-intake-chrome": "" } : {})}
    >
      {memberLoginEgress ? null : (
        <a href={backHref} data-portal-registration-back>
          {registrationIntakeResume ? (
            <>
              <span data-portal-registration-back-label>
                {t("intake.backToTourDetails")}
              </span>
              <RegistrationBackIcon />
            </>
          ) : (
            t("backToTour")
          )}
        </a>
      )}
      <div data-portal-registration-brand>
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt=""
            data-portal-registration-logo
            height={32}
            width={32}
          />
        ) : registrationIntakeResume ? (
          <Mountain aria-hidden="true" data-portal-registration-brand-icon />
        ) : null}
        <span data-portal-registration-workspace-label>{workspaceLabel}</span>
      </div>
    </header>
  );
}
