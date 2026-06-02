import { decodeJwtPayload } from "@/lib/auth/decode-jwt-payload";
import { getStoredSessionToken } from "@/lib/auth/session";
import { resolveTenantSlugFromHost } from "@/lib/tenant/runtime-tenant-context";

/** Cross-workspace navigation / host-bridge keys (not tied to one tenant row). */
export const SCOPED_STORAGE_GLOBAL_TENANT = "_global";
/** Device-level UI preferences (theme) shared across workspaces on one browser profile. */
export const SCOPED_STORAGE_DEVICE_TENANT = "_device";
/** Fallback partition when host slug and JWT tenant are unavailable (loopback apex). */
export const SCOPED_STORAGE_DEFAULT_TENANT = "_default";

export type ScopedStorageBackend = "local" | "session";

/**
 * Strict multi-tenant storage key: `{namespace}:{tenantId}:{key}`.
 * Prevents cross-tenant contamination on shared origins (bare localhost, persistent viewports).
 */
export function buildScopedStorageKey(
  namespace: string,
  tenantId: string,
  key: string,
): string {
  const ns = namespace.trim();
  const tenant = tenantId.trim();
  const logical = key.trim();
  if (!ns || !tenant || !logical) {
    throw new Error("scoped-storage: namespace, tenantId, and key must be non-empty");
  }
  return `${ns}:${tenant}:${logical}`;
}

function readBrowserStorage(backend: ScopedStorageBackend): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return backend === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Resolves the active tenant partition for browser persistence.
 * Prefers explicit hints, then host subdomain slug, then JWT `tenant_id`, then `_default`.
 */
export function resolveStorageTenantId(hint?: {
  tenantId?: string | null;
  workspaceId?: string | null;
  token?: string | null;
}): string {
  const explicit = hint?.tenantId?.trim() || hint?.workspaceId?.trim();
  if (explicit) {
    return explicit;
  }

  if (typeof window !== "undefined") {
    const slug = resolveTenantSlugFromHost(window.location.hostname);
    if (slug) {
      return slug;
    }
  }

  const token = hint?.token?.trim() || getStoredSessionToken() || undefined;
  if (token) {
    const claims = decodeJwtPayload(token);
    const fromJwt =
      typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : "";
    if (fromJwt) {
      return fromJwt;
    }
  }

  return SCOPED_STORAGE_DEFAULT_TENANT;
}

export class ScopedStorage {
  constructor(
    private readonly namespace: string,
    private readonly tenantId: string,
    private readonly backend: Storage | null,
  ) {}

  scopedKey(logicalKey: string): string {
    return buildScopedStorageKey(this.namespace, this.tenantId, logicalKey);
  }

  getItem(logicalKey: string): string | null {
    if (!this.backend) {
      return null;
    }
    try {
      return this.backend.getItem(this.scopedKey(logicalKey));
    } catch {
      return null;
    }
  }

  setItem(logicalKey: string, value: string): void {
    if (!this.backend) {
      return;
    }
    try {
      this.backend.setItem(this.scopedKey(logicalKey), value);
    } catch {
      /* quota / private mode */
    }
  }

  removeItem(logicalKey: string): void {
    if (!this.backend) {
      return;
    }
    try {
      this.backend.removeItem(this.scopedKey(logicalKey));
    } catch {
      /* ignore */
    }
  }

  getJson<T>(logicalKey: string): T | null {
    const raw = this.getItem(logicalKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setJson(logicalKey: string, value: unknown): void {
    this.setItem(logicalKey, JSON.stringify(value));
  }

  /**
   * One-time read from a legacy unscoped key, migrating into the scoped partition when found.
   */
  migrateLegacyItem(logicalKey: string, legacyKey: string): string | null {
    const scoped = this.getItem(logicalKey);
    if (scoped) {
      return scoped;
    }
    if (!this.backend || !legacyKey.trim()) {
      return null;
    }
    try {
      const legacy = this.backend.getItem(legacyKey.trim());
      if (legacy == null) {
        return null;
      }
      this.setItem(logicalKey, legacy);
      this.backend.removeItem(legacyKey.trim());
      return legacy;
    } catch {
      return null;
    }
  }
}

export function createScopedLocalStorage(namespace: string, tenantId: string): ScopedStorage {
  return new ScopedStorage(namespace, tenantId, readBrowserStorage("local"));
}

export function createScopedSessionStorage(namespace: string, tenantId: string): ScopedStorage {
  return new ScopedStorage(namespace, tenantId, readBrowserStorage("session"));
}
