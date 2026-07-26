import { Mountain, User } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PORTAL_MEMBER_SHELL_TEST_IDS } from "./portal-member-nav.types";

export type PortalMemberHeaderChrome = {
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly profileHref: string;
};

export type PortalMemberHeaderProps = {
  readonly workspaceLabel: string;
  readonly logoUrl: string | null;
  readonly marketingHomeUrl: string;
  readonly member: PortalMemberHeaderChrome;
};

/**
 * Minimal member portal header (PS-VIS-5e).
 * Brand → marketing · member chip → profile.
 * Logout lives in side-rail footer (desktop) / profile session (mobile) — PS-VIS-5f.
 */
export async function PortalMemberHeader({
  workspaceLabel,
  logoUrl,
  marketingHomeUrl,
  member,
}: PortalMemberHeaderProps) {
  const t = await getTranslations("portalMember.nav");

  return (
    <header
      data-portal-shell-header
      data-marketing-header
      data-portal-member-header-minimal=""
      data-slot="shell-header"
      data-testid={PORTAL_MEMBER_SHELL_TEST_IDS.header}
    >
      <div data-marketing-header-inner data-slot="shell-header-inner">
        <a
          href={marketingHomeUrl}
          data-marketing-brand
          data-portal-shell-brand
          data-slot="shell-brand"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              data-marketing-logo
              data-portal-shell-logo
              height={36}
              width={36}
            />
          ) : (
            <Mountain aria-hidden="true" data-marketing-brand-icon />
          )}
          <span data-marketing-brand-title data-portal-shell-workspace-label>
            {workspaceLabel}
          </span>
        </a>

        <div data-marketing-header-end data-slot="shell-header-end">
          <div data-marketing-header-toolbar data-slot="shell-toolbar">
            <a
              href={member.profileHref}
              data-marketing-portal-member
              data-marketing-header-member
              data-marketing-header-account
              aria-label={t("account")}
            >
              <span data-marketing-header-member-avatar-wrap>
                {member.avatarUrl !== null && member.avatarUrl.length > 0 ? (
                  <img
                    src={member.avatarUrl}
                    alt=""
                    data-marketing-header-member-avatar
                    height={32}
                    width={32}
                  />
                ) : (
                  <User aria-hidden="true" data-marketing-header-member-icon />
                )}
              </span>
              <span data-marketing-header-member-meta>
                <span data-marketing-header-member-label>{member.displayName}</span>
                <span data-marketing-header-member-hint>{t("account")}</span>
              </span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
