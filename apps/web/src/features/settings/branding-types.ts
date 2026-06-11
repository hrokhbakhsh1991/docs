export type TenantBrandingState = {
  readonly displayName: string | null;
  readonly logo: {
    readonly storageKey: string;
    readonly contentType: string | null;
  } | null;
  readonly primaryColor: string | null;
};

export const BRANDING_SETTINGS_TEST_IDS = {
  page: "operator-settings-branding-page",
  readOnlyBanner: "operator-settings-branding-read-only-banner",
  displayName: "operator-settings-branding-display-name",
  logoPreview: "operator-settings-branding-logo-preview",
  logoUpload: "operator-settings-branding-logo-upload",
  logoRemove: "operator-settings-branding-logo-remove",
  save: "operator-settings-branding-save",
} as const;
