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
      data-testid={PORTAL_MEMBER_SHELL_TEST_IDS.header}
      className="sticky top-0 z-40 flex min-h-14 items-center justify-between gap-3 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur-md"
    >
      <span className="truncate text-sm font-semibold">{workspaceLabel}</span>
      <PortalMemberUserMenu items={userMenuNav} />
    </header>
  );
}
