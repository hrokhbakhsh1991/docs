import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";
import {
  parseReservedLabelsCsv,
  parseWorkspaceTenantLabelFromHost,
} from "@repo/tenant-host";

import {
  evaluateWorkspaceHost,
  isBareApexHost as isBareApexHostFromPolicy,
} from "@/lib/tenant/workspace-host-policy";

export type TenantContext = {
  tenantSlug: string;
  tenantId?: string;
};

export type TenantDomainMode = "development" | "production";

export class TenantResolutionError extends Error {
  readonly code = "TENANT_RESOLUTION_FAILED" as const;

  constructor(message: string) {
    super(message);
    this.name = "TenantResolutionError";
  }
}

export { TENANT_SUBDOMAIN_REGEX as WORKSPACE_SUBDOMAIN_REGEX } from "@repo/tenant-host";
export { isBareApexHostFromPolicy as isBareApexHost };

export function isValidWorkspaceSubdomainLabel(label: string): boolean {
  const root = resolveTenantRootDomain();
  const normalized = label.trim().toLowerCase();
  const outcome = parseWorkspaceTenantLabelFromHost(
    `${normalized}.${root}`,
    root,
    parseReservedLabelsCsv(process.env.NEXT_PUBLIC_TENANT_HOST_RESERVED_SUBDOMAINS),
  );
  return outcome.kind === "label" && outcome.label === normalized;
}

export function resolveTenantDomainMode(): TenantDomainMode {
  const root = process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN?.trim();
  if (root === "localhost") {
    return "development";
  }
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function resolveTenantRootDomain(): string {
  const fromEnv = process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const mode = resolveTenantDomainMode();
  if (mode === "production") {
    throw new TenantResolutionError(
      "NEXT_PUBLIC_TENANT_ROOT_DOMAIN is required in production mode",
    );
  }
  return "localhost";
}

export function resolveTenantSlugFromHost(host: string | null | undefined): string | null {
  const evaluated = evaluateWorkspaceHost(host);
  return evaluated.ok ? evaluated.slug : null;
}

export function hasWorkspaceSubdomainHost(host: string | null | undefined): boolean {
  return resolveTenantSlugFromHost(host) !== null;
}

export function buildTenantSubdomainOrigin(
  tenantSlug: string,
  options?: { apiPort?: string; secure?: boolean },
): string {
  const slug = tenantSlug.trim().toLowerCase();
  const root = resolveTenantRootDomain();
  const mode = resolveTenantDomainMode();
  if (mode === "production") {
    const secure = options?.secure !== false;
    return `${secure ? "https" : "http"}://${slug}.${root}`;
  }
  const port = options?.apiPort?.trim() || process.env.NEXT_PUBLIC_API_PORT?.trim() || "3001";
  return `http://${slug}.${root}:${port}`;
}

export function buildTenantHostHeader(tenantSlug: string): string {
  const slug = tenantSlug.trim().toLowerCase();
  const root = resolveTenantRootDomain();
  const mode = resolveTenantDomainMode();
  if (mode === "production") {
    return `${slug}.${root}`;
  }
  const port = process.env.NEXT_PUBLIC_API_PORT?.trim() || "3001";
  return `${slug}.${root}:${port}`;
}

export function tryTenantIdFromJwtPayload(token: string): string | undefined {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return undefined;
    }
    const payloadPart = parts[1];
    if (!payloadPart) {
      return undefined;
    }
    const json = Buffer.from(
      payloadPart.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const payload = JSON.parse(json) as { tenant_id?: unknown; tenantId?: unknown };

    const id =
      (typeof payload.tenant_id === "string" && payload.tenant_id.trim()) ||
      (typeof payload.tenantId === "string" && payload.tenantId.trim());

    return id || undefined;
  } catch {
    return undefined;
  }
}

export function tryTenantIdFromRequestHeaders(headers: Headers): string | undefined {
  const headerTenantId = headers.get("x-tenant-id")?.trim();
  if (headerTenantId) {
    return headerTenantId;
  }
  const cookieSession = trySessionFromCookieHeader(headers.get("cookie"));
  return cookieSession.tenantId;
}

function trySessionFromCookieHeader(cookieHeader: string | null): { tenantId?: string } {
  if (!cookieHeader?.trim()) {
    return {};
  }
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${SESSION_TOKEN_COOKIE}=([^;]+)`),
  );
  const raw = match?.[1]?.trim();
  if (!raw) {
    return {};
  }
  const tenantId = tryTenantIdFromJwtPayload(decodeURIComponent(raw));
  return tenantId ? { tenantId } : {};
}

import { resolveInboundHostname } from "@/lib/tenant/trusted-forwarded-host";

function resolveInboundHost(headers: Headers, remoteIp?: string): string | null {
  return resolveInboundHostname(headers, { remoteIp });
}

function tenantContextFromSlug(slug: string, headers: Headers): TenantContext {
  const tenantId = tryTenantIdFromRequestHeaders(headers);
  return {
    tenantSlug: slug,
    ...(tenantId ? { tenantId } : {}),
  };
}

/**
 * BFF: slug only from inbound Host (never client `x-tenant-slug`).
 */
export function resolveBffTenantContext(req: Request, remoteIp?: string): TenantContext {
  const evaluated = evaluateWorkspaceHost(resolveInboundHost(req.headers, remoteIp));
  if (!evaluated.ok) {
    throw new TenantResolutionError(
      `Workspace host rejected (${evaluated.reason}). Use {slug}.${resolveTenantRootDomain()}.`,
    );
  }
  return tenantContextFromSlug(evaluated.slug, req.headers);
}

/**
 * SSR / page routes: trusted `x-tenant-slug` from middleware, else Host.
 */
export function resolveRuntimeTenantContextFromTrustedHeaders(
  headers: Headers,
  remoteIp?: string,
): TenantContext {
  const injectedSlug = headers.get("x-tenant-slug")?.trim();
  const slug = injectedSlug || resolveTenantSlugFromHost(resolveInboundHost(headers, remoteIp));

  if (!slug) {
    throw new TenantResolutionError(
      "Workspace tenant could not be resolved from Host. Use {slug}.localhost (e.g. ws1-rbac.localhost).",
    );
  }

  return tenantContextFromSlug(slug, headers);
}

export async function resolveRuntimeTenantContextFromNextHeaders(): Promise<TenantContext> {
  const { headers: h } = await import("next/headers");
  return resolveRuntimeTenantContextFromTrustedHeaders(h());
}

/**
 * Resolves tenant slug from `window.location.host` when in the browser.
 * Returns `null` during SSR or before mount — never touches `window` on the server.
 */
export function tryResolveClientRuntimeTenantContext(): TenantContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const evaluated = evaluateWorkspaceHost(window.location.host);
  if (!evaluated.ok) {
    return null;
  }
  return { tenantSlug: evaluated.slug };
}

/** @throws {TenantResolutionError} when not in a browser or host is not a workspace subdomain */
export function resolveClientRuntimeTenantContext(): TenantContext {
  const ctx = tryResolveClientRuntimeTenantContext();
  if (!ctx) {
    if (typeof window === "undefined") {
      throw new TenantResolutionError("Client tenant resolution requires a browser context");
    }
    throw new TenantResolutionError(
      "Workspace tenant could not be resolved from window.location.host",
    );
  }
  return ctx;
}
