import { resolveMemberPortalHubPresentation } from "@app-tour/workspace-sdk";

import type { PortalMemberNavItem } from "@/shell/resolve-portal-member-nav.server";

export type MemberHubModuleItem = {
  readonly id: string;
  readonly routePath: string;
  readonly labelKey: string;
};

export type MemberHubPayload = {
  readonly ok: true;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly evaluatedAt: string;
  readonly presentation: ReturnType<typeof resolveMemberPortalHubPresentation>;
  readonly modules: readonly MemberHubModuleItem[];
};

/** PS-6 — More hub list from entitled secondary nav (DL-10). */
export function buildMemberHubPayload(input: {
  readonly tenantId: string;
  readonly pluginId: string;
  readonly hubNav: readonly PortalMemberNavItem[];
}): MemberHubPayload {
  const modules = Object.freeze(
    input.hubNav.map((item) =>
      Object.freeze({
        id: item.testId.replace(/^portal-shell-nav-/, ""),
        routePath: item.href,
        labelKey: item.labelKey,
      })
    )
  );

  return Object.freeze({
    ok: true,
    tenantId: input.tenantId,
    workspaceId: input.pluginId,
    evaluatedAt: new Date().toISOString(),
    presentation: resolveMemberPortalHubPresentation(modules.length),
    modules,
  });
}
