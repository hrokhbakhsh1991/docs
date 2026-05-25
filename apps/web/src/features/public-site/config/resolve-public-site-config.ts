import type { ContentWorkspace, Page } from "@repo/shared-contracts";
import {
  getWorkspacePages,
  resolveContentWorkspaceForTenantSlug,
  resolveDefaultTourFormProfileForContentWorkspace,
} from "@repo/shared-contracts";
import type { TourFormProfile } from "@repo/types";

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
  denali: "برنامه Denali",
  general: "برنامه کلاسیک",
  arctic: "برنامه کلاسیک",
  urban: "برنامه کلاسیک",
};

export type PublicSiteConfig = {
  readonly tenantSlug: string;
  readonly contentWorkspace: ReturnType<typeof resolveContentWorkspaceForTenantSlug>;
  readonly programLabel: string;
  readonly tourFormProfile: TourFormProfile;
  readonly wizard: WorkspaceWizardConfig;
  readonly pages: {
    readonly landing: Page;
    readonly about: Page;
  };
  readonly catalog: {
    readonly listPath: string;
    readonly detailPath: (tourId: string) => string;
    readonly registerPath: (tourId: string) => string;
    readonly apiStatus: PublicCatalogApiStatus;
  };
  readonly nav: readonly PublicSiteNavItem[];
};

/**
 * Single resolver for public marketing + catalog routes.
 * Pages and hooks must read this object — no `profile === "denali_pilot"` in UI.
 */
export function resolvePublicSiteConfig(tenantSlug: string): PublicSiteConfig {
  const normalized = tenantSlug.trim().toLowerCase();
  const contentWorkspace = resolveContentWorkspaceForTenantSlug(normalized);
  const programLabel = CONTENT_WORKSPACE_PROGRAM_LABEL[contentWorkspace];
  const tourFormProfile = resolveDefaultTourFormProfileForContentWorkspace(contentWorkspace);
  const wizard = buildWizardConfig(tourFormProfile);
  const pages = getWorkspacePages(contentWorkspace);

  const catalogListPath = "/catalog";

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
      listPath: catalogListPath,
      detailPath: (tourId) => `${catalogListPath}/${encodeURIComponent(tourId)}`,
      registerPath: (tourId) =>
        `${catalogListPath}/${encodeURIComponent(tourId)}/register`,
      apiStatus: "completed",
    },
    nav: [
      { label: "خانه", href: "/" },
      { label: "تورها", href: catalogListPath },
      { label: "درباره", href: "/about" },
      { label: "ورود", href: "/login" },
    ],
  };
}
