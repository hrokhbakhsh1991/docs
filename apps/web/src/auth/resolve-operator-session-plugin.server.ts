import { resolveAdminBootstrapForWebHost } from "@/tenant/resolve-admin-bootstrap.server";

type AdminBootstrap = Awaited<ReturnType<typeof resolveAdminBootstrapForWebHost>>;
type AdminBootstrapResolver = (host: string) => Promise<AdminBootstrap>;

/** Resolve authenticated workspace metadata from the host's authoritative tenant binding. */
export async function resolveOperatorSessionPluginIdForHost(
  tenantId: string,
  host: string,
  resolveBootstrap: AdminBootstrapResolver = resolveAdminBootstrapForWebHost
): Promise<string | null> {
  try {
    const bootstrap = await resolveBootstrap(host);
    if (bootstrap.tenantId !== tenantId) {
      return null;
    }

    const pluginId = bootstrap.pluginId.trim();
    return pluginId.length > 0 ? pluginId : null;
  } catch {
    return null;
  }
}
