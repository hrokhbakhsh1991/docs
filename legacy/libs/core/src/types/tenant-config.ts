/** Preferred color scheme when the user has no stored preference. */
export type TenantThemeMode = "light" | "dark" | "system";

/**
 * Tenant-scoped visual branding and CSS token overrides.
 * Keys in `cssVariables` are token names without the leading `--` (e.g. `color-primary`).
 */
export type TenantThemeConfig = {
  defaultMode?: TenantThemeMode;
  brandName?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  /**
   * Shorthand for the workspace brand color — expanded to semantic `--color-primary*` tokens
   * on the client (overridden by explicit `cssVariables` entries).
   */
  primaryColor?: string;
  cssVariables?: Readonly<Record<string, string>>;
};

export type TenantLayoutVariant = "sidebar-left" | "sidebar-right" | "top-nav";

/** Sidebar placement; maps to {@link TenantLayoutVariant} on the client. */
export type TenantSidebarPosition = "left" | "right" | "top";

/** Leader dashboard widget identifiers rendered by the workspace shell. */
export type TenantDashboardWidgetId =
  | "tourList"
  | "stats"
  | "registrations"
  | "reconciliation"
  | "finance"
  | "usersDirectory";

export const DEFAULT_DASHBOARD_WIDGETS: readonly TenantDashboardWidgetId[] = [
  "tourList",
  "registrations",
  "reconciliation",
  "finance",
  "stats",
  "usersDirectory",
] as const;

export type TenantNavItem = {
  path: string;
  /** i18n message key under the `nav` namespace. */
  labelKey?: string;
  /** Fallback label when no translation key is provided. */
  label?: string;
};

export type TenantLayoutConfig = {
  variant?: TenantLayoutVariant;
  /** Preferred over `variant` when both are set. */
  sidebarPosition?: TenantSidebarPosition;
  sidebarWidthPx?: number;
  showThemeToggle?: boolean;
  /** When `false`, UI transitions/animations are suppressed for this workspace. */
  enableAnimations?: boolean;
  /** Ordered dashboard widget ids; empty/absent uses {@link DEFAULT_DASHBOARD_WIDGETS}. */
  dashboardWidgets?: readonly TenantDashboardWidgetId[];
  navItems?: readonly TenantNavItem[];
};

export type TenantFeatureConfig = {
  /** Dashboard / home widget identifiers enabled for this tenant. */
  widgets?: readonly string[];
  /** Product module identifiers (e.g. `finance`, `form_builder`). */
  modules?: readonly string[];
  /** Arbitrary boolean feature flags keyed by name. */
  flags?: Readonly<Record<string, boolean>>;
};

/** Workspace-scoped configuration for theming, layout, and feature toggles. */
export type TenantConfig = {
  tenantId: string;
  theme: TenantThemeConfig;
  layout: TenantLayoutConfig;
  features: TenantFeatureConfig;
};

export function createDefaultTenantConfig(tenantId = ""): TenantConfig {
  return {
    tenantId,
    theme: {},
    layout: {
      dashboardWidgets: [...DEFAULT_DASHBOARD_WIDGETS],
    },
    features: {},
  };
}

const DASHBOARD_WIDGET_IDS = new Set<string>(DEFAULT_DASHBOARD_WIDGETS);

export function isTenantDashboardWidgetId(value: string): value is TenantDashboardWidgetId {
  return DASHBOARD_WIDGET_IDS.has(value);
}

/** Resolves shell layout variant from tenant layout config. */
export function resolveTenantLayoutVariant(layout: TenantLayoutConfig): TenantLayoutVariant {
  switch (layout.sidebarPosition) {
    case "top":
      return "top-nav";
    case "right":
      return "sidebar-right";
    case "left":
      return "sidebar-left";
    default:
      break;
  }
  return layout.variant ?? "sidebar-left";
}

export function resolveTenantDashboardWidgets(
  layout: TenantLayoutConfig,
): readonly TenantDashboardWidgetId[] {
  const configured = layout.dashboardWidgets?.filter(isTenantDashboardWidgetId);
  if (configured && configured.length > 0) {
    return configured;
  }
  return DEFAULT_DASHBOARD_WIDGETS;
}
