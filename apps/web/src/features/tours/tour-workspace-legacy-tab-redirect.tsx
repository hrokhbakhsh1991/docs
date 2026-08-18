"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { hrefForWorkspaceTab, workspaceBasePath } from "@/features/tours/tour-workspace-logic";
import type { TourWorkspaceSubnavTab } from "@/features/tours/tour-workspace-types";

type TourWorkspaceLegacyTabRedirectProps = {
  readonly tourId: string;
  readonly tab: TourWorkspaceSubnavTab;
};

/** Client canonicalization for legacy segment routes (in-app navigation). */
export function TourWorkspaceLegacyTabRedirect({
  tourId,
  tab,
}: TourWorkspaceLegacyTabRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace(hrefForWorkspaceTab(tourId, tab), { scroll: false });
  }, [router, tab, tourId]);

  return null;
}

type TourWorkspaceRegistrationsAliasRedirectProps = {
  readonly tourId: string;
};

/** Alias — registrations tab lives at `/tours/[id]/workspace`. */
export function TourWorkspaceRegistrationsAliasRedirect({
  tourId,
}: TourWorkspaceRegistrationsAliasRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace(workspaceBasePath(tourId), { scroll: false });
  }, [router, tourId]);

  return null;
}
