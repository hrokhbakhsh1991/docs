/**
 * MAT-011 — per-workspace resource policy primitives (tenant + workspace identity).
 */

export type WorkspaceResourceQuota = {
  readonly readRpm?: number;
  readonly writeRpm?: number;
  readonly maxConcurrentWrites?: number;
};

export type WorkspaceResourcePolicy = {
  readonly workspaceType: string;
  readonly quota: WorkspaceResourceQuota;
  readonly exempt?: boolean;
};

const DEFAULT_WORKSPACE_WRITE_RPM = 120;
const DEFAULT_WORKSPACE_READ_RPM = 600;
const DEFAULT_WORKSPACE_MAX_CONCURRENT_WRITES = 8;

function readPositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return undefined;
}

/** Parse workspace-scoped quota overrides from tenant theme JSON. */
export function parseWorkspaceResourceQuotaFromTheme(
  theme: unknown,
  workspaceType: string
): WorkspaceResourceQuota | null {
  if (theme === null || typeof theme !== "object") {
    return null;
  }
  const root = theme as Record<string, unknown>;
  const workspaces = root.workspaceResourceQuotas;
  if (workspaces === null || typeof workspaces !== "object") {
    return null;
  }
  const row = (workspaces as Record<string, unknown>)[workspaceType];
  if (row === null || typeof row !== "object") {
    return null;
  }
  const quota = row as Record<string, unknown>;
  const readRpm = readPositiveInt(quota.readRpm);
  const writeRpm = readPositiveInt(quota.writeRpm);
  const maxConcurrentWrites = readPositiveInt(quota.maxConcurrentWrites);
  if (readRpm === undefined && writeRpm === undefined && maxConcurrentWrites === undefined) {
    return null;
  }
  return {
    ...(readRpm !== undefined ? { readRpm } : {}),
    ...(writeRpm !== undefined ? { writeRpm } : {}),
    ...(maxConcurrentWrites !== undefined ? { maxConcurrentWrites } : {}),
  };
}

export function resolveWorkspaceResourcePolicy(input: {
  readonly workspaceType: string | null | undefined;
  readonly themeQuota?: WorkspaceResourceQuota | null;
  readonly systemExempt?: boolean;
}): WorkspaceResourcePolicy | null {
  const workspaceType = input.workspaceType?.trim();
  if (workspaceType === undefined || workspaceType.length === 0) {
    return null;
  }
  if (input.systemExempt === true) {
    return { workspaceType, quota: {}, exempt: true };
  }
  const themeQuota = input.themeQuota ?? {};
  return {
    workspaceType,
    quota: {
      readRpm: themeQuota.readRpm ?? DEFAULT_WORKSPACE_READ_RPM,
      writeRpm: themeQuota.writeRpm ?? DEFAULT_WORKSPACE_WRITE_RPM,
      maxConcurrentWrites:
        themeQuota.maxConcurrentWrites ?? DEFAULT_WORKSPACE_MAX_CONCURRENT_WRITES,
    },
  };
}

/** Rate-limit key segment — workspace A cannot consume workspace B bucket. */
export function workspaceResourceConsumerKey(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly connectionTier: string;
  readonly operationTier: "read" | "write";
  readonly method?: string;
  readonly path?: string;
}): string {
  const method = input.method ?? "POST";
  const path = input.path ?? "/tours";
  return `${input.tenantId}:${input.workspaceType}:${input.connectionTier}:${input.operationTier}:${method}:${path}`;
}

/** In-flight write slot key — per tenant + workspace. */
export function workspaceWriteConcurrencyKey(tenantId: string, workspaceType: string): string {
  return `${tenantId.trim()}:${workspaceType.trim()}`;
}
