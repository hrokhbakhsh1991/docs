import { BFF } from "@/lib/api-paths";
import { inflightBffGet } from "@/lib/auth/inflight-bff-get";

export type MembershipAbilityContextWire = {
  labels: string[];
  capabilities: string[];
  effective_capabilities?: string[];
  jwt_capability_snapshot?: string[];
  allowed_region_ids?: string[];
  tenant_modules?: string[];
};

/** Loads CASL hydration slice via same-origin BFF (Host-scoped session). */
export async function fetchMembershipAbilityContext(
  signal?: AbortSignal,
): Promise<MembershipAbilityContextWire | null> {
  const body = await inflightBffGet(BFF.authMembershipAbilityContext, async () => {
    const res = await fetch(BFF.authMembershipAbilityContext, {
      credentials: "include",
      cache: "no-store",
      signal,
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json().catch(() => null)) as MembershipAbilityContextWire | null;
  });

  if (!body || !Array.isArray(body.labels)) {
    return { labels: [], capabilities: [] };
  }

  return {
    labels: body.labels.filter((l): l is string => typeof l === "string"),
    capabilities: Array.isArray(body.capabilities)
      ? body.capabilities.filter((c): c is string => typeof c === "string")
      : [],
    effective_capabilities: Array.isArray(body.effective_capabilities)
      ? body.effective_capabilities.filter((c): c is string => typeof c === "string")
      : [],
    jwt_capability_snapshot: Array.isArray(body.jwt_capability_snapshot)
      ? body.jwt_capability_snapshot.filter((c): c is string => typeof c === "string")
      : [],
    allowed_region_ids: Array.isArray(body.allowed_region_ids)
      ? body.allowed_region_ids.filter((id): id is string => typeof id === "string")
      : [],
    tenant_modules: Array.isArray(body.tenant_modules)
      ? body.tenant_modules.filter((m): m is string => typeof m === "string")
      : [],
  };
}
