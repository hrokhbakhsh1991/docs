import {
  TOUR_WORKSPACE_TEST_IDS,
  type TourWorkspaceSubnavTab,
} from "./tour-workspace-types";

export function workspaceBasePath(tourId: string): string {
  return `/tours/${encodeURIComponent(tourId)}/workspace`;
}

export function hrefForWorkspaceTab(tourId: string, tab: TourWorkspaceSubnavTab): string {
  const base = workspaceBasePath(tourId);
  if (tab === "registrations") {
    return base;
  }
  return `${base}/${tab}`;
}

export function resolveWorkspaceSubnavTab(
  pathname: string,
  tourId: string
): TourWorkspaceSubnavTab {
  const base = workspaceBasePath(tourId);
  if (pathname === base || pathname === `${base}/`) {
    return "registrations";
  }
  if (pathname.startsWith(`${base}/waitlist`)) {
    return "waitlist";
  }
  if (pathname.startsWith(`${base}/transport`)) {
    return "transport";
  }
  return "registrations";
}

export const TOUR_WORKSPACE_SUBNAV_TABS: ReadonlyArray<{
  tab: TourWorkspaceSubnavTab;
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
