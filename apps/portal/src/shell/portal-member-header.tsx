import { PortalMemberUserMenu } from "./portal-member-user-menu";
import type { PortalMemberNavItem } from "./portal-member-nav.types";
import { PORTAL_MEMBER_SHELL_TEST_IDS } from "./portal-member-nav.types";

export type PortalMemberHeaderProps = {
  readonly workspaceLabel: string;
  readonly userMenuNav: readonly PortalMemberNavItem[];
};

export function PortalMemberHeader({ workspaceLabel, userMenuNav }: PortalMemberHeaderProps) {
  return (
    <header
      data-portal-shell-header
      data-slot="shell-header"
      data-testid={PORTAL_MEMBER_SHELL_TEST_IDS.header}
    >
      <span data-portal-shell-workspace-label>{workspaceLabel}</span>
      <PortalMemberUserMenu items={userMenuNav} />
    </header>
  );
}
