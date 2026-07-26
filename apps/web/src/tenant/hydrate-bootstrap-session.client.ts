import {
  bindWorkspaceThemeAccess,
  createTenantAuthz,
} from "@app-tour/workspace-sdk/auth";

import { requireWorkspacePluginId } from "@/bootstrap/workspace-plugin-context-errors";
import { resolveBootstrapWorkspacePluginClient } from "@/bootstrap/resolve-bootstrap-workspace-plugin.client";
import type { AppSession } from "@/session/app-session";

import { resolveTenantContext } from "./tenant-kernel.shared";
import type { ResolvedBootstrapSession, SerializableBootstrap } from "./tenant-kernel.types";

export function hydrateBootstrapSession(
  serializable: SerializableBootstrap
): ResolvedBootstrapSession {
  const context = resolveTenantContext({
    userId: serializable.context.userId,
    tenantId: serializable.context.tenantId,
    workspaceId: serializable.context.workspaceId ?? "default",
    role: serializable.context.role,
    status: serializable.context.status,
  });
  const scoped = createTenantAuthz(context);
  const pluginId = requireWorkspacePluginId(serializable.pluginId);
  const plugin = resolveBootstrapWorkspacePluginClient(pluginId);
  const workspaceThemeAccess = bindWorkspaceThemeAccess(scoped.context, {
    workspaceId: context.workspaceId!,
    pluginId,
  });
  const session: AppSession = {
    authz: scoped,
    tenantId: context.tenantId,
    workspaceId: context.workspaceId!,
    pluginId,
  };
  return {
    session,
    context,
    scopedAuthz: scoped,
    workspaceThemeAccess,
    plugin,
  };
}
