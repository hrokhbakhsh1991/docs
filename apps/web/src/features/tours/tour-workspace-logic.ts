import {
  TOUR_WORKSPACE_TEST_IDS,
  type TourWorkspaceSubnavTab,
} from "./tour-workspace-types";

export function workspaceBasePath(tourId: string): string {
  return `/tours/${encodeURIComponent(tourId)}/workspace`;
}

export const WORKSPACE_TAB_QUERY_KEY = "tab";
export const WORKSPACE_FOCUS_REGISTRATION_QUERY_KEY = "focusRegistrationId";

/** Parse `?tab=` (defaults to registrations). */
export function parseWorkspaceTabParam(
  raw: string | null | undefined
): TourWorkspaceSubnavTab {
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "waitlist" || trimmed === "transport" || trimmed === "finance" || trimmed === "operations") {
    return trimmed;
  }
  return "registrations";
}

export function parseWorkspaceFocusRegistrationId(
  raw: string | null | undefined
): string | null {
  const id = raw?.trim() ?? "";
  // Bound length — registration ids are UUIDs; reject junk deep-links.
  if (id.length === 0 || id.length > 128) {
    return null;
  }
  return id;
}

/** Canonical workspace tab href — single route + query (avoids per-tab page segments). */
export function hrefForWorkspaceTab(
  tourId: string,
  tab: TourWorkspaceSubnavTab,
  options?: { readonly focusRegistrationId?: string | null }
): string {
  return buildWorkspaceTabReplacePath(workspaceBasePath(tourId), tab, undefined, options);
}

/**
 * Build replace path for workspace tab switch (FINANCE-OPS-UX §5 — prefer router.replace over Link).
 * H-11 — optional focusRegistrationId only applies on finance tab; cleared otherwise.
 */
export function buildWorkspaceTabReplacePath(
  workspacePath: string,
  tab: TourWorkspaceSubnavTab,
  currentParams?: URLSearchParams | string,
  options?: { readonly focusRegistrationId?: string | null }
): string {
  const next =
    currentParams instanceof URLSearchParams
      ? new URLSearchParams(currentParams.toString())
      : new URLSearchParams(currentParams ?? "");
  if (tab === "registrations") {
    next.delete(WORKSPACE_TAB_QUERY_KEY);
  } else {
    next.set(WORKSPACE_TAB_QUERY_KEY, tab);
  }
  const focus = options?.focusRegistrationId?.trim() ?? "";
  if (tab === "finance" && focus.length > 0) {
    next.set(WORKSPACE_FOCUS_REGISTRATION_QUERY_KEY, focus);
  } else {
    next.delete(WORKSPACE_FOCUS_REGISTRATION_QUERY_KEY);
  }
  const qs = next.toString();
  return qs.length > 0 ? `${workspacePath}?${qs}` : workspacePath;
}

export function workspacePathForTour(tourId: string): string {
  return workspaceBasePath(tourId);
}

export function resolveWorkspaceSubnavTab(
  pathname: string,
  tourId: string,
  tabParam?: string | null
): TourWorkspaceSubnavTab {
  const base = workspaceBasePath(tourId);
  if (pathname === base || pathname === `${base}/`) {
    return parseWorkspaceTabParam(tabParam);
  }
  /** Legacy segment routes (redirect targets) — remove after bookmarks migrate. */
  if (pathname.startsWith(`${base}/waitlist`)) {
    return "waitlist";
  }
  if (pathname.startsWith(`${base}/transport`)) {
    return "transport";
  }
  if (pathname.startsWith(`${base}/operations`)) {
    return "operations";
  }
  if (pathname.startsWith(`${base}/finance`)) {
    return "finance";
  }
  if (pathname.startsWith(`${base}/registrations`)) {
    return "registrations";
  }
  return "registrations";
}

const TOUR_WORKSPACE_BASE_SUBNAV_TABS: ReadonlyArray<{
  tab: Exclude<TourWorkspaceSubnavTab, "finance" | "operations">;
  testId: string;
}> = [
  {
    tab: "registrations",
    testId: TOUR_WORKSPACE_TEST_IDS.tabRegistrations,
  },
  {
    tab: "waitlist",
    testId: TOUR_WORKSPACE_TEST_IDS.tabWaitlist,
  },
  {
    tab: "transport",
    testId: TOUR_WORKSPACE_TEST_IDS.tabTransport,
  },
];

/** Core tabs; operations/finance appended when workspace capability allows. */
export function listTourWorkspaceSubnavTabs(options?: {
  readonly includeFinance?: boolean;
  readonly includeOperations?: boolean;
}): ReadonlyArray<{ tab: TourWorkspaceSubnavTab; testId: string }> {
  const tabs: Array<{ tab: TourWorkspaceSubnavTab; testId: string }> = [
    ...TOUR_WORKSPACE_BASE_SUBNAV_TABS,
  ];
  if (options?.includeOperations === true) {
    tabs.push({
      tab: "operations",
      testId: TOUR_WORKSPACE_TEST_IDS.tabOperations,
    });
  }
  if (options?.includeFinance === true) {
    tabs.push({
      tab: "finance",
      testId: TOUR_WORKSPACE_TEST_IDS.tabFinance,
    });
  }
  return tabs;
}

/** @deprecated Prefer listTourWorkspaceSubnavTabs — kept for existing imports. */
export const TOUR_WORKSPACE_SUBNAV_TABS = listTourWorkspaceSubnavTabs();
