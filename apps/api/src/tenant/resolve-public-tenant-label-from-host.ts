import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseWorkspaceTenantLabelFromHost,
} from "@app-tour/tenant-kernel";

export function readPublicTenantFallbackHostsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): ReadonlySet<string> {
  const raw = env.PUBLIC_TENANT_FALLBACK_HOSTS?.trim();
  if (raw === undefined || raw.length === 0) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase().split(":")[0] ?? "")
      .filter((entry) => entry.length > 0)
  );
}

export function readPublicTenantFallbackLabelFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const label = env.PUBLIC_TENANT_FALLBACK_LABEL?.trim().toLowerCase();
  return label !== undefined && label.length > 0 ? label : null;
}

function isIpv4Host(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

/** Bare IP / loopback hosts used before DNS subdomain ingress exists. */
export function isBarePublicIngressHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().split(":")[0] ?? "";
  if (normalized.length === 0) {
    return false;
  }
  return normalized === "localhost" || normalized === "127.0.0.1" || isIpv4Host(normalized);
}

export type ResolvePublicTenantLabelResult =
  | { readonly kind: "label"; readonly label: string; readonly source: "subdomain" | "fallback" }
  | { readonly kind: "unknown" };

/**
 * Resolves workspace label for public tenant-context/branding routes.
 * Subdomain `{label}.{TENANT_ROOT_DOMAIN}` wins; optional env fallback for raw IP staging.
 */
export function resolvePublicTenantLabelFromIngressHost(
  ingressHost: string,
  options?: {
    readonly rootDomain?: string;
    readonly reservedLabels?: ReadonlySet<string>;
    readonly env?: NodeJS.ProcessEnv;
  }
): ResolvePublicTenantLabelResult {
  const env = options?.env ?? process.env;
  const rootDomain = options?.rootDomain ?? env.TENANT_ROOT_DOMAIN ?? "localhost";
  const reserved =
    options?.reservedLabels ?? new Set<string>(DEFAULT_TENANT_HOST_RESERVED_LABELS);
  const hostname = ingressHost.trim().toLowerCase().split(":")[0] ?? "";

  const outcome = parseWorkspaceTenantLabelFromHost(hostname, rootDomain, reserved);
  if (outcome.kind === "label") {
    return { kind: "label", label: outcome.label, source: "subdomain" };
  }

  const fallbackLabel = readPublicTenantFallbackLabelFromEnv(env);
  if (fallbackLabel === null) {
    return { kind: "unknown" };
  }

  const allowedHosts = readPublicTenantFallbackHostsFromEnv(env);
  if (allowedHosts.size > 0) {
    if (!allowedHosts.has(hostname)) {
      return { kind: "unknown" };
    }
  } else if (!isBarePublicIngressHost(hostname)) {
    return { kind: "unknown" };
  }

  if (reserved.has(fallbackLabel)) {
    return { kind: "unknown" };
  }

  return { kind: "label", label: fallbackLabel, source: "fallback" };
}
