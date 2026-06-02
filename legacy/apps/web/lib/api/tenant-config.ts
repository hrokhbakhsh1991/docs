"use client";

import { useQuery } from "@tanstack/react-query";

import {
  createDefaultTenantConfig,
  isTenantDashboardWidgetId,
  type TenantConfig,
  type TenantDashboardWidgetId,
  type TenantFeatureConfig,
  type TenantLayoutConfig,
  type TenantSidebarPosition,
  type TenantThemeConfig,
} from "@repo/core";

import { tenantConfigKeys } from "@/lib/query-keys";

import { useAuthBffQueryGateForTenant } from "@/hooks/use-auth-bff-query-gate";

/** Same-origin BFF route (mock until Nest workspace config endpoint ships). */
export function tenantConfigBffPath(tenantId: string): string {
  return `/api/workspaces/${encodeURIComponent(tenantId)}/tenant-config`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function asBooleanRecord(value: unknown): Readonly<Record<string, boolean>> | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const out: Record<string, boolean> = {};
  for (const [key, v] of Object.entries(record)) {
    if (typeof v === "boolean") {
      out[key] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseCssVariables(raw: unknown): Readonly<Record<string, string>> | undefined {
  const cssVariables = asRecord(raw);
  if (!cssVariables) {
    return undefined;
  }
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(cssVariables)) {
    if (typeof k === "string" && typeof v === "string") {
      vars[k] = v;
    }
  }
  return Object.keys(vars).length > 0 ? vars : undefined;
}

function parseThemeConfig(raw: unknown): TenantThemeConfig {
  const o = asRecord(raw);
  if (!o) {
    return {};
  }
  const defaultMode = o.defaultMode;
  const theme: TenantThemeConfig = {};
  if (defaultMode === "light" || defaultMode === "dark" || defaultMode === "system") {
    theme.defaultMode = defaultMode;
  }
  const brandName = asString(o.brandName);
  if (brandName) {
    theme.brandName = brandName;
  }
  if (o.logoUrl === null || typeof o.logoUrl === "string") {
    theme.logoUrl = o.logoUrl as string | null;
  }
  if (o.faviconUrl === null || typeof o.faviconUrl === "string") {
    theme.faviconUrl = o.faviconUrl as string | null;
  }
  const primaryColor = asString(o.primaryColor);
  if (primaryColor) {
    theme.primaryColor = primaryColor;
  }
  const cssVariables = parseCssVariables(o.cssVariables);
  if (cssVariables) {
    theme.cssVariables = cssVariables;
  }
  return theme;
}

function parseDashboardWidgets(raw: unknown): readonly TenantDashboardWidgetId[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const items = raw.filter(
    (value): value is TenantDashboardWidgetId =>
      typeof value === "string" && isTenantDashboardWidgetId(value),
  );
  return items.length > 0 ? items : undefined;
}

function parseSidebarPosition(raw: unknown): TenantSidebarPosition | undefined {
  return raw === "left" || raw === "right" || raw === "top" ? raw : undefined;
}

function parseLayoutConfig(raw: unknown): TenantLayoutConfig {
  const o = asRecord(raw);
  if (!o) {
    return {};
  }
  const variant = o.variant;
  const sidebarPosition = parseSidebarPosition(o.sidebarPosition);
  const navItems = Array.isArray(o.navItems)
    ? o.navItems
        .map((item) => {
          const row = asRecord(item);
          const path = asString(row?.path);
          if (!path) {
            return null;
          }
          return {
            path,
            ...(asString(row?.labelKey) ? { labelKey: asString(row?.labelKey) } : {}),
            ...(asString(row?.label) ? { label: asString(row?.label) } : {}),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item != null)
    : undefined;

  const dashboardWidgets = parseDashboardWidgets(o.dashboardWidgets);

  return {
    ...(variant === "sidebar-left" || variant === "sidebar-right" || variant === "top-nav"
      ? { variant }
      : {}),
    ...(sidebarPosition ? { sidebarPosition } : {}),
    ...(typeof o.sidebarWidthPx === "number" && Number.isFinite(o.sidebarWidthPx)
      ? { sidebarWidthPx: o.sidebarWidthPx }
      : {}),
    ...(typeof o.showThemeToggle === "boolean" ? { showThemeToggle: o.showThemeToggle } : {}),
    ...(typeof o.enableAnimations === "boolean" ? { enableAnimations: o.enableAnimations } : {}),
    ...(dashboardWidgets ? { dashboardWidgets } : {}),
    ...(navItems && navItems.length > 0 ? { navItems } : {}),
  };
}

function parseFeatureConfig(raw: unknown): TenantFeatureConfig {
  const o = asRecord(raw);
  if (!o) {
    return {};
  }
  return {
    ...(asStringArray(o.widgets) ? { widgets: asStringArray(o.widgets) } : {}),
    ...(asStringArray(o.modules) ? { modules: asStringArray(o.modules) } : {}),
    ...(asBooleanRecord(o.flags) ? { flags: asBooleanRecord(o.flags) } : {}),
  };
}

/** Normalizes wire JSON into {@link TenantConfig}; unknown fields are dropped. */
export function parseTenantConfigWire(body: unknown, tenantId: string): TenantConfig {
  const o = asRecord(body);
  const base = createDefaultTenantConfig(tenantId);
  if (!o) {
    return base;
  }
  return {
    tenantId: asString(o.tenantId) ?? tenantId,
    theme: { ...base.theme, ...parseThemeConfig(o.theme) },
    layout: { ...base.layout, ...parseLayoutConfig(o.layout) },
    features: { ...base.features, ...parseFeatureConfig(o.features) },
  };
}

async function parseJsonOrEmpty(res: Response): Promise<unknown> {
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null;
  }
  const text = await res.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Fetches tenant configuration for a workspace.
 * On HTTP or network failure, returns a safe default config (never throws).
 */
export async function fetchTenantConfig(tenantId: string): Promise<TenantConfig> {
  const scoped = tenantId.trim();
  if (!scoped) {
    return createDefaultTenantConfig();
  }

  try {
    const res = await fetch(tenantConfigBffPath(scoped), {
      credentials: "include",
      cache: "no-store",
    });
    const body = await parseJsonOrEmpty(res);
    if (!res.ok) {
      return createDefaultTenantConfig(scoped);
    }
    return parseTenantConfigWire(body, scoped);
  } catch {
    return createDefaultTenantConfig(scoped);
  }
}

export function useTenantConfigQuery(tenantId: string | null | undefined) {
  const scopedTenantId = tenantId?.trim() ?? "";
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(scopedTenantId);

  return useQuery({
    queryKey: tenantConfigKeys.detail(scopedTenantId),
    queryFn: () => fetchTenantConfig(scopedTenantId),
    enabled: authBffQueryEnabled,
    placeholderData: () => createDefaultTenantConfig(scopedTenantId),
    retry: 1,
  });
}
