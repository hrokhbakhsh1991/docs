import { PortalMemberUserMenu } from "./portal-member-user-menu";
import { PortalLocaleSwitcher } from "@/i18n/portal-locale-switcher";
import type { PortalMemberNavItem } from "./portal-member-nav.types";
import { PORTAL_MEMBER_SHELL_TEST_IDS } from "./portal-member-nav.types";

export type PortalMemberHeaderProps = {
  readonly workspaceLabel: string;
  readonly logoUrl: string | null;
  readonly userMenuNav: readonly PortalMemberNavItem[];
};

export function PortalMemberHeader({
  workspaceLabel,
  logoUrl,
  userMenuNav,
}: PortalMemberHeaderProps) {
  return (
    <header
      data-portal-shell-header
      data-slot="shell-header"
      data-testid={PORTAL_MEMBER_SHELL_TEST_IDS.header}
    >
      <div data-portal-shell-brand data-slot="shell-brand">
        {logoUrl ? (
          <img src={logoUrl} alt="" data-portal-shell-logo height={32} width={32} />
        ) : null}
        <span data-portal-shell-workspace-label>{workspaceLabel}</span>
      </div>
      <div data-portal-shell-header-end data-slot="shell-header-end">
        <PortalLocaleSwitcher />
        <PortalMemberUserMenu items={userMenuNav} />
      </div>
    </header>
  );
}
