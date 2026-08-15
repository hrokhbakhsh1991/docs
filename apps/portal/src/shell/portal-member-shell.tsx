import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import type { EmbeddedMemberPortalHost } from "@app-tour/guest-surface-host";

import { PortalMemberBottomNav } from "./portal-member-bottom-nav";
import {
  PortalMemberHeader,
  type PortalMemberHeaderChrome,
} from "./portal-member-header";
import type { PortalMemberNavItem } from "./portal-member-nav.types";
import { PORTAL_MEMBER_SHELL_TEST_IDS } from "./portal-member-nav.types";

export type PortalMemberShellProps = {
  readonly workspaceLabel: string;
  readonly logoUrl: string | null;
  readonly bottomNav: readonly PortalMemberNavItem[];
  readonly marketingHomeUrl: string;
  readonly memberHeader: PortalMemberHeaderChrome;
  readonly embeddedHost?: EmbeddedMemberPortalHost | null;
  readonly children: ReactNode;
};

export async function PortalMemberShell({
  workspaceLabel,
  logoUrl,
  bottomNav,
  marketingHomeUrl,
  memberHeader,
  embeddedHost = null,
  children,
}: PortalMemberShellProps) {
  const t = await getTranslations("portalMember.nav");

  return (
    <div
      data-portal-shell
      data-slot="shell"
      data-marketing-member-authenticated=""
      {...(embeddedHost !== null && embeddedHost !== undefined
        ? { "data-embedded-host": embeddedHost }
        : {})}
    >
      <a
        href={`#${PORTAL_MEMBER_SHELL_TEST_IDS.main}`}
        data-portal-shell-skip-link
        data-testid={PORTAL_MEMBER_SHELL_TEST_IDS.skipLink}
      >
        {t("skipToMain")}
      </a>

      <PortalMemberHeader
        workspaceLabel={workspaceLabel}
        logoUrl={logoUrl}
        marketingHomeUrl={marketingHomeUrl}
        member={memberHeader}
      />

      <div
        id={PORTAL_MEMBER_SHELL_TEST_IDS.main}
        data-portal-shell-main
        data-slot="shell-main"
      >
        <div data-portal-shell-main-inner>{children}</div>
      </div>

      <PortalMemberBottomNav items={bottomNav} logoutTarget={marketingHomeUrl} />
    </div>
  );
}
