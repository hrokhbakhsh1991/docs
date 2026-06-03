"use client";

import type { ReactNode } from "react";

import {
  canAccessWorkspaceTheme,
  type ScopedTenantAuthz,
  type TenantAuthz,
  type WorkspacePlugin,
  type WorkspaceThemeContract,
  type WorkspaceThemeSubject,
} from "@app-tour/workspace-sdk";
import type { AppAbility } from "@app-tour/workspace-sdk/auth/casl";
import { canAccessWorkspaceTheme as canAccessWorkspaceThemeWithAbility } from "@app-tour/workspace-sdk/auth/casl";

import { useThemeIngressGuard } from "../ingress/useThemeIngressGuard";
import { workspaceThemeToStyle } from "./normalize-workspace-theme-style";

export type WorkspaceThemeProviderProps = {
  plugin: WorkspacePlugin;
  theme?: WorkspaceThemeContract;
  /**
   * Prefer {@link ScopedTenantAuthz} from createTenantAuthz — binds tenant coherence.
   */
  authz: TenantAuthz | ScopedTenantAuthz;
  /**
   * Optional CASL bridge (§15.3): when set, `ability.can(Access, WorkspaceTheme)` runs
   * **before** ingress — in addition to {@link authz} (both must pass).
   */
  ability?: AppAbility;
  workspaceThemeAccess: WorkspaceThemeSubject;
  children: ReactNode;
};

/**
 * Authority gate runs before ingress. On deny: children only, no workspace DOM scope.
 */
function resolveThemeAccessGate(
  authz: TenantAuthz | ScopedTenantAuthz,
  ability: AppAbility | undefined,
  workspaceThemeAccess: WorkspaceThemeSubject,
  pluginId: string,
): boolean {
  if (ability !== undefined) {
    const caslOk = canAccessWorkspaceThemeWithAbility({
      ability,
      access: workspaceThemeAccess,
      pluginId,
    });
    if (!caslOk) {
      return false;
    }
  }

  if ("context" in authz && "authz" in authz) {
    return canAccessWorkspaceTheme({
      authz: authz.authz,
      access: workspaceThemeAccess,
      pluginId,
      boundTenantId: authz.context.tenantId,
    });
  }
  return canAccessWorkspaceTheme({
    authz,
    access: workspaceThemeAccess,
    pluginId,
  });
}

export function WorkspaceThemeProvider({
  authz,
  ability,
  workspaceThemeAccess,
  ...themedProps
}: WorkspaceThemeProviderProps) {
  if (!resolveThemeAccessGate(authz, ability, workspaceThemeAccess, themedProps.plugin.id)) {
    return <>{themedProps.children}</>;
  }

  return <WorkspaceThemeProviderThemed {...themedProps} />;
}

type WorkspaceThemeProviderThemedProps = Pick<
  WorkspaceThemeProviderProps,
  "plugin" | "theme" | "children"
>;

function WorkspaceThemeProviderThemed({
  plugin,
  theme,
  children,
}: WorkspaceThemeProviderThemedProps) {
  const guarded = useThemeIngressGuard(plugin, theme ?? plugin.theme);

  if (!guarded.theme) {
    return <>{children}</>;
  }

  const resolvedTheme = guarded.theme!;

  return (
    <div
      data-workspace-theme={resolvedTheme.id}
      style={workspaceThemeToStyle(resolvedTheme)}
    >
      {children}
    </div>
  );
}
