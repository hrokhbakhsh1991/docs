import type { SettingsModuleKind, SettingsNavGroup } from "@app-tour/workspace-sdk";

export type SettingsModuleMetadata = {
  readonly id: string;
  readonly kind: SettingsModuleKind;
  readonly route: string;
  readonly ability: string;
  readonly nav: {
    readonly group: SettingsNavGroup;
    readonly labelKey: string;
  };
};

export type SettingsModulesListResponse = {
  readonly items: readonly SettingsModuleMetadata[];
};

export type EquipmentResource = {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly category: string | null;
  /** Tour theme ids from operator settings (`/settings/tour-themes`). Empty = all themes. */
  readonly themeIds: readonly string[];
  /** Denali wizard — tour categories compatible with this equipment row (DEC-P12-001 / 12.1). */
  readonly compatibleCategories?: readonly string[];
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type SettingsResourceListResponse = {
  readonly items: readonly EquipmentResource[];
  readonly total: number;
};

export type CreateEquipmentRequest = {
  readonly name: string;
  readonly category?: string;
  readonly themeIds?: readonly string[];
};

export type PatchEquipmentRequest = {
  readonly name?: string;
  readonly category?: string | null;
  readonly themeIds?: readonly string[];
};

export type WizardTemplateSection = {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
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

export type WizardTemplatePayloadV1 = {
  readonly seedLabel: string;
  readonly sections: readonly WizardTemplateSection[];
  readonly published?: boolean;
  readonly steps?: readonly WizardTemplateStepRef[];
};

export type PresetsAdvancedMatchRule = {
  readonly id: string;
  readonly tourType: string | null;
  readonly themeId: string | null;
  readonly presetId: string | null;
  readonly enabled: boolean;
};

export type PresetsAdvancedPayloadV1 = {
  readonly autoMatchEnabled: boolean;
  readonly defaultPresetId: string | null;
  readonly matchRules: readonly PresetsAdvancedMatchRule[];
};

export type TenantConfigPayload = WizardTemplatePayloadV1 | PresetsAdvancedPayloadV1;

export type TenantConfigRecord = {
  readonly tenantId: string;
  readonly configKey: string;
  readonly configVersion: number;
  readonly payload: TenantConfigPayload;
  readonly updatedAt: string;
};

export type SettingsConfigResponse = {
  readonly configKey: string;
  readonly configVersion: number;
  readonly source: "tenant" | "workspace";
  readonly payload: TenantConfigPayload;
  readonly updatedAt: string | null;
};

export type PutSettingsConfigRequest = {
  readonly configVersion: number;
  readonly payload: TenantConfigPayload;
};

export type AuditTrailEvent = {
  readonly id: string;
  readonly tenantId: string;
  readonly occurredAt: string;
  readonly actorUserId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly summary: string;
};

export type AuditTrailListResponse = {
  readonly items: readonly AuditTrailEvent[];
  readonly total: number;
};

export type TourThemeResource = {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly slug: string;
  readonly formProfile: string | null;
  /** Denali wizard — tour categories compatible with this theme's formProfile (DEC-P11-016). */
  readonly compatibleCategories?: readonly string[];
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TourThemesListResponse = {
  readonly items: readonly TourThemeResource[];
  readonly total: number;
};

export type RegionResource = {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly country: string | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type DestinationResource = {
  readonly id: string;
  readonly tenantId: string;
  readonly regionId: string;
  readonly name: string;
  readonly locationType: string | null;
  readonly altitudeM: number | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type LocationsListResponse = {
  readonly regions: readonly RegionResource[];
  readonly destinations: readonly DestinationResource[];
  readonly total: number;
};

export type CreateTourThemeRequest = {
  readonly name: string;
  readonly slug?: string;
  readonly isActive?: boolean;
};

export type PatchTourThemeRequest = {
  readonly name?: string;
  readonly slug?: string;
  readonly isActive?: boolean;
};

export type GuideLanguageResource = {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly slug: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type GuideLanguagesListResponse = {
  readonly items: readonly GuideLanguageResource[];
  readonly total: number;
};

export type CreateGuideLanguageRequest = {
  readonly name: string;
  readonly slug?: string;
  readonly isActive?: boolean;
};

export type PatchGuideLanguageRequest = {
  readonly name?: string;
  readonly slug?: string;
  readonly isActive?: boolean;
};

export type TourPresetResource = {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string | null;
  readonly themeId: string | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TourPresetsListResponse = {
  readonly items: readonly TourPresetResource[];
  readonly total: number;
};

export type CreateTourPresetRequest = {
  readonly name: string;
  readonly description?: string;
  readonly themeId?: string;
  readonly isActive?: boolean;
};

export type PatchTourPresetRequest = {
  readonly name?: string;
  readonly description?: string | null;
  readonly themeId?: string | null;
  readonly isActive?: boolean;
};

export type CreateLocationResourceRequest =
  | {
      readonly entity: "region";
      readonly name: string;
      readonly country?: string;
    }
  | {
      readonly entity: "destination";
      readonly regionId: string;
      readonly name: string;
      readonly locationType?: string;
    };

export type PatchLocationResourceRequest = {
  readonly name?: string;
  readonly country?: string | null;
  readonly regionId?: string;
  readonly locationType?: string | null;
  readonly isActive?: boolean;
};
