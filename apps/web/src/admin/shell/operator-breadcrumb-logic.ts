export type OperatorBreadcrumbNamespace = "nav" | "app" | "settings" | "tours" | "bookings";

export type OperatorBreadcrumbSegment = {
  readonly namespace: OperatorBreadcrumbNamespace;
  readonly key: string;
  readonly href?: string;
};

const NAV_ROOTS: Record<string, OperatorBreadcrumbSegment> = {
  "/dashboard": { namespace: "nav", key: "dashboard" },
  "/tours": { namespace: "nav", key: "tours" },
  "/bookings": { namespace: "nav", key: "bookings" },
  "/users": { namespace: "nav", key: "users" },
  "/settings": { namespace: "nav", key: "settings" },
  "/finance": { namespace: "nav", key: "finance" },
  "/leader/review": { namespace: "nav", key: "dashboard" },
};

const SETTINGS_MODULE_BY_PATH: Record<string, string> = {
  me: "account_profile",
  equipment: "equipment",
  "guide-languages": "guide_languages",
  "tour-themes": "tour_themes",
  locations: "locations",
  "tour-presets": "tour_presets",
  "tour-presets/advanced": "tour_presets_advanced",
  "tour-wizard-template": "tour_wizard_template",
  "audit-trail": "audit_trail",
  "reconciliation-triage": "reconciliation_triage",
  urban: "urban.title",
};

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0] ?? pathname;
  if (withoutQuery.length <= 1) {
    return "/dashboard";
  }
  return withoutQuery.replace(/\/$/, "");
}

export function resolveOperatorBreadcrumbSegments(
  pathname: string
): readonly OperatorBreadcrumbSegment[] {
  const path = normalizePathname(pathname);

  const root = NAV_ROOTS[path];
  if (root !== undefined) {
    return [root];
  }

  if (path === "/tours/new") {
    return [
      { namespace: "nav", key: "tours", href: "/tours" },
      { namespace: "app", key: "newTour" },
    ];
  }

  if (path.startsWith("/tours/") && path.endsWith("/edit")) {
    return [
      { namespace: "nav", key: "tours", href: "/tours" },
      { namespace: "tours", key: "nav.editTour" },
    ];
  }

  if (path.startsWith("/bookings/new")) {
    return [
      { namespace: "nav", key: "bookings", href: "/bookings" },
      { namespace: "bookings", key: "create.pageTitle" },
    ];
  }

  if (path.startsWith("/bookings/")) {
    return [
      { namespace: "nav", key: "bookings", href: "/bookings" },
      { namespace: "bookings", key: "detailTitle" },
    ];
  }

  if (path.startsWith("/settings/")) {
    const subPath = path.slice("/settings/".length);
    const moduleKey = SETTINGS_MODULE_BY_PATH[subPath];
    if (moduleKey !== undefined) {
      const settingsKey = moduleKey.includes(".")
        ? moduleKey
        : `modules.${moduleKey}.title`;
      return [
        { namespace: "nav", key: "settings", href: "/settings" },
        { namespace: "settings", key: settingsKey },
      ];
    }
  }

  const firstSegment = `/${path.split("/").filter(Boolean)[0] ?? ""}`;
  const fallback = NAV_ROOTS[firstSegment];
  if (fallback !== undefined) {
    return [fallback];
  }

  return [{ namespace: "nav", key: "dashboard", href: "/dashboard" }];
}
