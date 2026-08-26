export type SettingsNavGroup = "account" | "workspace" | "templates" | "finance_ops";

export type SettingsModuleKind =
  | "reference_data"
  | "tenant_config"
  | "readonly_explorer"
  | "account_preference";

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
  readonly name: string;
  readonly category: string | null;
  readonly iconKey?: string | null;
  readonly themeIds: readonly string[];
  readonly compatibleCategories?: readonly string[];
  readonly sortOrder: number;
};

export type SettingsResourceListResponse = {
  readonly items: readonly EquipmentResource[];
  readonly total: number;
};

export type TourThemeResource = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly formProfile: string | null;
  readonly iconKey?: string | null;
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

export type TourPresetResource = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly themeId: string | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export type TourPresetsListResponse = {
  readonly items: readonly TourPresetResource[];
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

export const SETTINGS_HUB_TEST_IDS = {
  page: "operator-settings-hub",
  moduleCard: "operator-settings-module-card",
  profilePage: "operator-settings-profile-page",
  profileForm: "operator-settings-profile-form",
  profileDisplayName: "operator-settings-profile-display-name",
  profileGender: "operator-settings-profile-gender",
  profileAvatar: "operator-settings-profile-avatar",
  profileAvatarUpload: "operator-settings-profile-avatar-upload",
  profileAvatarRemove: "operator-settings-profile-avatar-remove",
  profileSave: "operator-settings-profile-save",
  equipmentPage: "operator-settings-equipment-page",
  equipmentList: "operator-settings-equipment-list",
  equipmentForm: "operator-settings-equipment-form",
  equipmentCreate: "operator-settings-equipment-create",
  tourThemesPage: "operator-settings-tour-themes-page",
  tourThemesList: "operator-settings-tour-themes-list",
  tourThemesForm: "operator-settings-tour-themes-form",
  locationsPage: "operator-settings-locations-page",
  locationsRegions: "operator-settings-locations-regions",
  locationsDestinations: "operator-settings-locations-destinations",
  guideLanguagesPage: "operator-settings-guide-languages-page",
  guideLanguagesList: "operator-settings-guide-languages-list",
  guideLanguagesForm: "operator-settings-guide-languages-form",
  tourPresetsPage: "operator-settings-tour-presets-page",
  tourPresetsList: "operator-settings-tour-presets-list",
  tourPresetsForm: "operator-settings-tour-presets-form",
  presetsAdvancedPage: "operator-presets-advanced-page",
  brandingPage: "operator-settings-branding-page",
  integrationsPage: "operator-settings-integrations-page",
  exposurePage: "operator-settings-exposure-page",
  exposureTelegramPanel: "operator-settings-exposure-telegram-panel",
} as const;

/** Message keys under the `settings` namespace (`modules.{id}.title`). */
export const SETTINGS_MODULE_LABEL_KEYS: Record<string, string> = {
  account_profile: "modules.account_profile.title",
  equipment: "modules.equipment.title",
  guide_languages: "modules.guide_languages.title",
  tour_themes: "modules.tour_themes.title",
  locations: "modules.locations.title",
  tour_presets: "modules.tour_presets.title",
  tour_wizard_template: "modules.tour_wizard_template.title",
  tour_presets_advanced: "modules.tour_presets_advanced.title",
  audit_trail: "modules.audit_trail.title",
  wizard_drafts: "modules.wizard_drafts.title",
  reconciliation_triage: "modules.reconciliation_triage.title",
  workspace_branding: "modules.workspace_branding.title",
  integrations: "modules.integrations.title",
  exposure: "modules.exposure.title",
};

/** @deprecated Use `SETTINGS_MODULE_LABEL_KEYS` — kept for stable imports in tests. */
export const SETTINGS_MODULE_LABELS = SETTINGS_MODULE_LABEL_KEYS;

export const SETTINGS_MODULE_DESCRIPTION_KEYS: Partial<Record<string, string>> = {
  tour_wizard_template: "modules.tour_wizard_template.description",
  equipment: "modules.equipment.description",
  guide_languages: "modules.guide_languages.description",
  tour_themes: "modules.tour_themes.description",
  locations: "modules.locations.description",
  tour_presets: "modules.tour_presets.description",
  tour_presets_advanced: "modules.tour_presets_advanced.description",
  audit_trail: "modules.audit_trail.description",
  wizard_drafts: "modules.wizard_drafts.description",
  reconciliation_triage: "modules.reconciliation_triage.description",
  account_profile: "modules.account_profile.description",
  workspace_branding: "modules.workspace_branding.description",
  integrations: "modules.integrations.description",
  exposure: "modules.exposure.description",
};

/** @deprecated Use `SETTINGS_MODULE_DESCRIPTION_KEYS`. */
export const SETTINGS_MODULE_DESCRIPTIONS = SETTINGS_MODULE_DESCRIPTION_KEYS;

export const SETTINGS_MODULE_KIND_KEYS: Record<SettingsModuleKind, string> = {
  reference_data: "kinds.reference_data",
  tenant_config: "kinds.tenant_config",
  readonly_explorer: "kinds.readonly_explorer",
  account_preference: "kinds.account_preference",
};

/** @deprecated Use `SETTINGS_MODULE_KIND_KEYS`. */
export const SETTINGS_MODULE_KIND_LABELS = SETTINGS_MODULE_KIND_KEYS;

export const SETTINGS_NAV_GROUP_KEYS: Record<SettingsNavGroup, string> = {
  account: "groups.account",
  workspace: "groups.workspace",
  templates: "groups.templates",
  finance_ops: "groups.finance_ops",
};

/** @deprecated Use `SETTINGS_NAV_GROUP_KEYS`. */
export const SETTINGS_NAV_GROUP_LABELS = SETTINGS_NAV_GROUP_KEYS;
