/** Phase 14.0 — manifest metadata for web surface codegen (DEC-P14-001). */

export type WorkspaceWizardSurfaceWebBinding = {
  readonly webModule: string;
  readonly export: string;
};

export type WorkspaceWizardSurfacesManifest = {
  readonly surfaceId?: string;
  readonly composite?: WorkspaceWizardSurfaceWebBinding;
  readonly review?: WorkspaceWizardSurfaceWebBinding;
};

export type WorkspaceWizardI18nManifest = {
  readonly messageNamespace: string;
  readonly labelResolver?: WorkspaceWizardSurfaceWebBinding;
};

export type WorkspaceWizardCloneRemintManifest = {
  readonly module: string;
  readonly workspaceTypeExport: string;
  readonly executeRemintExport: string;
  readonly assertDestKeyExport: string;
  readonly readConfigExport: string;
};

export type WorkspaceWizardCreateManifest = {
  readonly extendedChrome?: boolean;
};
