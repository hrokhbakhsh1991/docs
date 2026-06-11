import type { TenantAuthContext, TenantThemeConfig } from "@app-tour/workspace-sdk";

import type { AppSession } from "@/session/app-session";

export type TenantKernelResolveInput = {
  readonly userId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly role: TenantAuthContext["role"];
  readonly status: TenantAuthContext["status"];
};

export type ResolvedBootstrapSession = {
  readonly session: AppSession;
  readonly context: TenantAuthContext;
  readonly scopedAuthz: import("@app-tour/workspace-sdk/auth").ScopedTenantAuthz;
  readonly workspaceThemeAccess: import("@app-tour/workspace-sdk").WorkspaceThemeSubject;
  readonly plugin: import("@app-tour/workspace-sdk").WorkspacePlugin;
};

export type SerializableBootstrap = {
  readonly context: TenantAuthContext;
  readonly tenantTheme?: TenantThemeConfig;
  readonly pluginId: string;
};
