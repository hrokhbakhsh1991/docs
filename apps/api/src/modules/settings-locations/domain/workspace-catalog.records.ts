import type { TourFormProfile } from "@repo/types";
import type { DenaliCanonicalTemplateData } from "@repo/types/denali";

/** Domain row for workspace regions (infra entity implements this shape). */
export type WorkspaceRegionRecord = {
  id: string;
  tenantId: string;
  name: string;
  country: string | null;
  sortOrder: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceDestinationRecord = {
  id: string;
  tenantId: string;
  regionId: string;
  name: string;
  type: string | null;
  altitudeM: number | null;
  sortOrder: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceEquipmentItemRecord = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  compatibleCategories: string[];
  description: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceGuideLanguageRecord = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceTourThemeRecord = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  formProfile: TourFormProfile;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceTourWizardStepOverrides = {
  skip: string[];
  insert: string[];
};

export type WorkspaceTourWizardTemplateRecord = {
  id: string;
  workspaceId: string;
  baseProfile: TourFormProfile;
  stepOverrides: WorkspaceTourWizardStepOverrides;
  fieldRulesOverlay: Record<string, unknown>;
  canonicalData: DenaliCanonicalTemplateData;
  presetId: string | null;
  wizardContractVersion: number;
  formProfileVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceTourCreationPresetRecord = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  matchTourType: string | null;
  matchMainTourThemeId: string | null;
  formProfile: TourFormProfile;
  canonicalData: DenaliCanonicalTemplateData;
  defaults: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};
