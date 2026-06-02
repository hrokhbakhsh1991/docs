import { headers } from "next/headers";

import {
  tryTenantIdFromRequestHeaders,
  type TenantContext,
} from "@/lib/tenant/runtime-tenant-context";
import { lookupWorkspaceTenantExists } from "@/lib/tenant/lookup-workspace-tenant";
import {
  evaluateWorkspaceHost,
  type WorkspaceHostRejectReason,
} from "@/lib/tenant/workspace-host-policy";

export type AssertWorkspaceResult =
  | { ok: true; tenant: TenantContext }
  | { ok: false; reason: WorkspaceHostRejectReason };

export async function assertWorkspaceRequest(
  headerBag?: Headers,
): Promise<AssertWorkspaceResult> {
  const h = headerBag ?? (await headers());
  const host = h.get("host");
  const evaluated = evaluateWorkspaceHost(host);

  if (!evaluated.ok) {
    return { ok: false, reason: evaluated.reason };
  }

  const injectedSlug = h.get("x-tenant-slug")?.trim().toLowerCase();
  if (injectedSlug === evaluated.slug) {
    const tenantId = tryTenantIdFromRequestHeaders(h);
    return {
      ok: true,
      tenant: {
        tenantSlug: evaluated.slug,
        ...(tenantId ? { tenantId } : {}),
      },
    };
  }

  const exists = await lookupWorkspaceTenantExists(evaluated.slug);
  if (!exists) {
    return { ok: false, reason: "unknown" };
  }

  const tenantId = tryTenantIdFromRequestHeaders(h);
  return {
    ok: true,
    tenant: {
      tenantSlug: evaluated.slug,
      ...(tenantId ? { tenantId } : {}),
    },
  };
}
