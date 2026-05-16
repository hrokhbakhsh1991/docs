import { parseReservedLabelsCsv } from "./constants";
import { normalizeInboundHostname } from "./normalize-inbound-hostname";
import {
  parseWorkspaceTenantLabelFromHost,
  resolveWorkspaceSlugFromNormalizedHost,
  type WorkspaceTenantLabelOutcome,
} from "./parse-workspace-tenant-label";

export type ResolveWorkspaceHostInput = {
  hostHeader: string | null | undefined;
  rootDomain: string;
  reservedLabelsCsv?: string;
};

export type ResolveWorkspaceHostResult =
  | { ok: true; slug: string; normalizedHost: string }
  | { ok: false; reason: "missing_host" | "invalid_host" | WorkspaceTenantLabelOutcome["kind"] };

export function resolveWorkspaceHost(
  input: ResolveWorkspaceHostInput,
): ResolveWorkspaceHostResult {
  const raw = input.hostHeader?.trim();
  if (!raw) {
    return { ok: false, reason: "missing_host" };
  }

  const normalized = normalizeInboundHostname(raw);
  if (!normalized.ok) {
    return { ok: false, reason: "invalid_host" };
  }

  const reserved = parseReservedLabelsCsv(input.reservedLabelsCsv);
  const outcome = parseWorkspaceTenantLabelFromHost(
    normalized.host,
    input.rootDomain,
    reserved,
  );

  if (outcome.kind === "label") {
    return { ok: true, slug: outcome.label, normalizedHost: normalized.host };
  }

  return { ok: false, reason: outcome.kind };
}

export { resolveWorkspaceSlugFromNormalizedHost, parseWorkspaceTenantLabelFromHost };
