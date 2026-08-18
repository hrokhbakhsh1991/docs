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
  if (trimmed === "waitlist" || trimmed === "transport" || trimmed === "finance") {
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

const LEGACY_WORKSPACE_SEGMENT_PATTERN =
  /^\/tours\/([^/]+)\/workspace\/(waitlist|transport|finance|registrations)\/?$/;

/**
 * Canonical redirect target for legacy `/workspace/{segment}` bookmarks.
 * Returns absolute path+query (e.g. `/tours/{id}/workspace?tab=waitlist`) or null.
 */
export function resolveTourWorkspaceLegacySegmentRedirect(pathname: string): string | null {
  const match = LEGACY_WORKSPACE_SEGMENT_PATTERN.exec(pathname);
  if (match === null) {
    return null;
  }
  const rawTourId = match[1]?.trim() ?? "";
  if (rawTourId.length === 0) {
    return null;
  }
  const segment = match[2];
  const base = `/tours/${rawTourId}/workspace`;
  if (segment === "registrations") {
    return base;
  }
  if (segment === "waitlist" || segment === "transport" || segment === "finance") {
    return `${base}?tab=${segment}`;
  }
  return null;
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
  if (pathname.startsWith(`${base}/finance`)) {
    return "finance";
  }
  if (pathname.startsWith(`${base}/registrations`)) {
    return "registrations";
  }
  return "registrations";
}

const TOUR_WORKSPACE_CORE_SUBNAV_TABS: ReadonlyArray<{
  tab: Exclude<TourWorkspaceSubnavTab, "finance">;
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

/** Core tabs always; finance appended when capability allows (TW-C-05). */
export function listTourWorkspaceSubnavTabs(options?: {
  readonly includeFinance?: boolean;
}): ReadonlyArray<{ tab: TourWorkspaceSubnavTab; testId: string }> {
  if (options?.includeFinance === true) {
    return [
      ...TOUR_WORKSPACE_CORE_SUBNAV_TABS,
      {
        tab: "finance",
        testId: TOUR_WORKSPACE_TEST_IDS.tabFinance,
      },
    ];
  }
  return TOUR_WORKSPACE_CORE_SUBNAV_TABS;
}

/** @deprecated Prefer listTourWorkspaceSubnavTabs — kept for existing imports. */
export const TOUR_WORKSPACE_SUBNAV_TABS = listTourWorkspaceSubnavTabs();
