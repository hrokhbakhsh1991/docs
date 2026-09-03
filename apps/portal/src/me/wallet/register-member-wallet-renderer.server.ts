import { registerWorkspaceMemberPortalRenderers } from "@app-tour/workspace-sdk";

import { renderMemberWalletPortalModule } from "./render-member-wallet-portal-module";

const registeredPlugins = new Set<string>();

/** Idempotent — registers workspace-neutral wallet renderer for any entitled member portal. */
export function ensureMemberWalletRendererRegistered(pluginId: string): void {
  if (registeredPlugins.has(pluginId)) {
    return;
  }
  registerWorkspaceMemberPortalRenderers(pluginId, {
    renderers: {
      wallet: renderMemberWalletPortalModule,
    },
  });
  registeredPlugins.add(pluginId);
}

export function resetMemberWalletRendererRegistrationForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    return;
  }
  registeredPlugins.clear();
}
