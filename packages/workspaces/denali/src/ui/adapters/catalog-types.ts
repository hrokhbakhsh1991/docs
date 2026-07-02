import type { ActorRole } from "@app-tour/workspace-sdk";

/** Operator settings catalog rows consumed by Denali wizard composites (BFF-shaped). */
export type EquipmentResource = {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
  readonly iconKey?: string | null;
  readonly themeIds: readonly string[];
  readonly compatibleCategories?: readonly string[];
  readonly sortOrder: number;
};

export type TourThemeResource = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly formProfile: string | null;
  readonly compatibleCategories?: readonly string[];
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export type TourThemesListResponse = {
  readonly items: readonly TourThemeResource[];
  readonly total: number;
};

export type GuideLanguageResource = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export type GuideLanguagesListResponse = {
  readonly items: readonly GuideLanguageResource[];
  readonly total: number;
};

export type RegionResource = {
  readonly id: string;
  readonly name: string;
  readonly country: string | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export type DestinationResource = {
  readonly id: string;
  readonly regionId: string;
  readonly name: string;
  readonly locationType: string | null;
  readonly altitudeM: number | null;
  readonly typicalTrailDistanceKm: number | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export type LocationsListResponse = {
  readonly regions: readonly RegionResource[];
  readonly destinations: readonly DestinationResource[];
  readonly total: number;
};

export type UsersDirectoryRow = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: Exclude<ActorRole, "none">;
  readonly status: string;
  readonly displayName: string;
  readonly avatarUrl?: string | null;
  readonly phone: string | null;
  readonly email?: string | null;
  readonly permanentDiscountPercentage?: number | null;
  readonly rewardBadges?: readonly string[];
  readonly isSelectableLeader?: boolean;
  readonly labels?: readonly string[];
  readonly lastActiveAt?: string | null;
};

export type UsersListResponse = {
  readonly items: readonly UsersDirectoryRow[];
  readonly total: number;
  readonly nextCursor?: string;
};

export type WizardTemplateFieldRef = {
  readonly canonicalPath: string;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly defaultValue?: string;
};

export type WizardTemplateStepRef = {
  readonly stepId: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly fields: readonly WizardTemplateFieldRef[];
};
