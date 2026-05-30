import type { ContentWorkspace, Page } from "@repo/shared-contracts";
import {
  getWorkspacePages,
  resolveContentWorkspaceForTenant,
  resolveDefaultTourFormProfileForContentWorkspace,
} from "@repo/shared-contracts";
import type { TourFormProfile } from "@repo/types";

import { PUBLIC_CATALOG_LIST_PATH } from "@/lib/paths";

import {
  buildWizardConfig,
  type WorkspaceWizardConfig,
} from "@/features/tours/wizard/workspace-wizard.config";

export type PublicSiteNavItem = {
  readonly label: string;
  readonly href: string;
};

/** Catalog list query bucket on Nest `GET /api/v2/tours` (`completed` = OPEN lifecycle). */
export type PublicCatalogApiStatus = "completed";

const CONTENT_WORKSPACE_PROGRAM_LABEL: Record<ContentWorkspace, string> = {
  outdoor_pilot: "برنامه Outdoor Pilot",
  general: "برنامه کلاسیک",
  arctic: "برنامه کلاسیک",
  urban: "برنامه کلاسیک",
};

export type PublicSiteConfig = {
  readonly tenantSlug: string;
  readonly contentWorkspace: ContentWorkspace;
  readonly programLabel: string;
  readonly tourFormProfile: TourFormProfile;
  readonly wizard: WorkspaceWizardConfig;
  readonly pages: {
    readonly landing: Page;
    readonly about: Page;
  };
  readonly catalog: {
    readonly listPath: string;
    readonly apiStatus: PublicCatalogApiStatus;
  };
  readonly nav: readonly PublicSiteNavItem[];
};

/**
 * Single resolver for public marketing + catalog routes.
 * Pages and hooks must read this object — no `profile === "denali_pilot"` in UI.
 */
export function resolvePublicSiteConfig(
  tenantSlug: string,
  options?: { tourFormProfile?: TourFormProfile; contentWorkspace?: ContentWorkspace },
): PublicSiteConfig {
  const normalized = tenantSlug.trim().toLowerCase();
  const contentWorkspace = resolveContentWorkspaceForTenant({
    tenantSlug: normalized,
    tourFormProfile: options?.tourFormProfile,
    contentWorkspace: options?.contentWorkspace,
  });
  const programLabel = CONTENT_WORKSPACE_PROGRAM_LABEL[contentWorkspace];
  const tourFormProfile =
    options?.tourFormProfile ?? resolveDefaultTourFormProfileForContentWorkspace(contentWorkspace);
  const wizard = buildWizardConfig(tourFormProfile);
  const pages = getWorkspacePages(normalized, {
    tourFormProfile,
    contentWorkspace,
  });

  return {
    tenantSlug: normalized,
    contentWorkspace,
    programLabel,
    tourFormProfile,
    wizard,
    pages: {
      landing: pages.landing,
      about: pages.about,
    },
    catalog: {
      listPath: PUBLIC_CATALOG_LIST_PATH,
      apiStatus: "completed",
    },
    nav: [
      { label: "خانه", href: "/" },
      { label: "تورها", href: PUBLIC_CATALOG_LIST_PATH },
      { label: "درباره", href: "/about" },
      { label: "ورود", href: "/login" },
    ],
  };
}
