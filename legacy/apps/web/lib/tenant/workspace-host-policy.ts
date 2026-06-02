import { resolveWorkspaceHost, type WorkspaceTenantLabelOutcome } from "@repo/tenant-host";

import { resolveTenantRootDomain } from "@/lib/tenant/runtime-tenant-context";

export type WorkspaceHostRejectReason =
  | "apex"
  | "outside_workspace"
  | "reserved"
  | "invalid_label"
  | "invalid_host"
  | "missing_host"
  | "no_root_config"
  | "unknown";

export type WorkspaceHostEvaluation =
  | { ok: true; slug: string }
  | { ok: false; reason: WorkspaceHostRejectReason };

function mapParseFailure(
  reason: Exclude<WorkspaceHostEvaluation, { ok: true }>["reason"] | WorkspaceTenantLabelOutcome["kind"],
): WorkspaceHostRejectReason {
  if (reason === "label") {
    return "unknown";
  }
  return reason as WorkspaceHostRejectReason;
}

export function evaluateWorkspaceHost(
  hostHeader: string | null | undefined,
): WorkspaceHostEvaluation {
  const result = resolveWorkspaceHost({
    hostHeader,
    rootDomain: resolveTenantRootDomain(),
    reservedLabelsCsv: process.env.NEXT_PUBLIC_TENANT_HOST_RESERVED_SUBDOMAINS,
  });

  if (result.ok) {
    return { ok: true, slug: result.slug };
  }

  if (result.reason === "missing_host" || result.reason === "invalid_host") {
    return { ok: false, reason: result.reason };
  }

  return { ok: false, reason: mapParseFailure(result.reason) };
}

function stripPortFromHost(host: string): string {
  const idx = host.indexOf(":");
  return (idx >= 0 ? host.slice(0, idx) : host).trim().toLowerCase();
}

/** Bare apex / loopback without a workspace label (blocks app UI on port-only hosts). */
export function isBareApexHost(host: string | null | undefined): boolean {
  const evaluated = evaluateWorkspaceHost(host);
  if (evaluated.ok) {
    return false;
  }
  if (evaluated.reason === "apex" || evaluated.reason === "missing_host") {
    return true;
  }
  const bare = host?.trim() ? stripPortFromHost(host.trim()) : "";
  return bare === "127.0.0.1" || bare === "::1";
}
