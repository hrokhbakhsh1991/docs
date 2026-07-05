import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import type { EmbeddedMemberPortalHost } from "@app-tour/guest-surface-host";

import { PortalMemberBottomNav } from "./portal-member-bottom-nav";
import { PortalMemberHeader } from "./portal-member-header";
import type { PortalMemberNavItem } from "./portal-member-nav.types";
import { PORTAL_MEMBER_SHELL_TEST_IDS } from "./portal-member-nav.types";

export type PortalMemberShellProps = {
  readonly workspaceLabel: string;
  readonly primaryNav: readonly PortalMemberNavItem[];
  readonly userMenuNav: readonly PortalMemberNavItem[];
  readonly embeddedHost?: EmbeddedMemberPortalHost | null;
  readonly children: ReactNode;
};

export async function PortalMemberShell({
  workspaceLabel,
  primaryNav,
  userMenuNav,
  embeddedHost = null,
  children,
}: PortalMemberShellProps) {
  const t = await getTranslations("portalMember.nav");

  return (
    <div
      data-portal-shell
      {...(embeddedHost !== null && embeddedHost !== undefined
        ? { "data-embedded-host": embeddedHost }
        : {})}
      className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]"
    >
      <a
        href={`#${PORTAL_MEMBER_SHELL_TEST_IDS.main}`}
        data-testid={PORTAL_MEMBER_SHELL_TEST_IDS.skipLink}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow start-4"
      >
        {t("skipToMain")}
      </a>

      <PortalMemberHeader workspaceLabel={workspaceLabel} userMenuNav={userMenuNav} />

      <div
        id={PORTAL_MEMBER_SHELL_TEST_IDS.main}
        data-portal-shell-main
        className="flex flex-1 flex-col px-4 py-8"
      >
        {children}
      </div>

      <PortalMemberBottomNav items={primaryNav} />
    </div>
  );
}
