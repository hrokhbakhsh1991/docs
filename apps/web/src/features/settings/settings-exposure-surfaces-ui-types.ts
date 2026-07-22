import type { ComponentType, ReactNode } from "react";

/**
 * Shell-owned contract for workspace exposure surfaces settings UI
 * (H1.b–H1.c.2.b: I/O + chrome + selection + package panel).
 */
export type SettingsExposureSurfacesCatalogField = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly adminLabel?: string;
  readonly adminDescription?: string;
  readonly group?: string;
  readonly icon?: string;
};

export type SettingsExposureSurfaceDefinition = {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly triggerLabel: string;
  readonly defaultFieldIds: readonly string[];
  readonly activeIntent: {
    readonly mode: "inherit_profile" | "override_fields" | "disabled";
    readonly selectedFieldIds: readonly string[] | null;
  } | null;
};

export type SettingsExposureSurfacesPatchInput = {
  readonly audience: string;
  readonly trigger: string;
  readonly enabled: boolean;
  readonly selectedFieldIds: readonly string[];
};

export type SettingsExposureSurfacesIo = {
  readonly loadSurfaces: (workspaceId: string) => Promise<{
    readonly surfaces: readonly SettingsExposureSurfaceDefinition[];
  }>;
  readonly saveSurfaceIntent: (
    workspaceId: string,
    surfaceKey: string,
    patch: SettingsExposureSurfacesPatchInput,
  ) => Promise<void>;
};

export type SettingsExposureCollapsibleSectionProps = {
  readonly title: string;
  readonly description?: string;
  readonly defaultOpen?: boolean;
  readonly badge?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export type SettingsExposureFieldChecklistContext = {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
};

export type SettingsExposureFieldChecklistField = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly adminLabel?: string;
  readonly adminDescription?: string;
  readonly group?: string;
  readonly icon?: string;
};

export type SettingsExposureFieldChecklistLabels = {
  readonly searchPlaceholder: string;
  readonly selectAllInGroup: string;
  readonly clearGroup: string;
  readonly selectedOfTotal: string;
};

export type SettingsExposureFieldChecklistProps = {
  readonly context: SettingsExposureFieldChecklistContext;
  readonly fields: readonly SettingsExposureFieldChecklistField[];
  readonly selectedFieldIds: readonly string[];
  readonly disabled?: boolean;
  readonly emptyLabel: string;
  readonly selectedSummary: string;
  readonly labels?: SettingsExposureFieldChecklistLabels;
  readonly onFieldToggle: (fieldId: string, checked: boolean) => void;
};

export type SettingsExposureBadgeProps = {
  readonly variant?: "default" | "outline";
  readonly className?: string;
  readonly children?: ReactNode;
};

export type SettingsExposureButtonProps = {
  readonly type?: "button" | "submit" | "reset";
  readonly size?: "sm" | "default" | "lg" | "icon";
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onClick?: () => void;
  readonly children?: ReactNode;
};

export type SettingsExposureCardProps = {
  readonly className?: string;
  readonly children?: ReactNode;
  readonly "data-testid"?: string;
  readonly "data-operator-surface"?: string;
};

export type SettingsExposureCardSectionProps = {
  readonly className?: string;
  readonly children?: ReactNode;
};

export type SettingsExposureLabelProps = {
  readonly htmlFor?: string;
  readonly className?: string;
  readonly children?: ReactNode;
};

export type SettingsExposureSkeletonProps = {
  readonly className?: string;
};

export type SettingsExposureSurfacesChrome = {
  readonly CollapsibleSection: ComponentType<SettingsExposureCollapsibleSectionProps>;
  readonly FieldChecklist: ComponentType<SettingsExposureFieldChecklistProps>;
  readonly Badge: ComponentType<SettingsExposureBadgeProps>;
  readonly Button: ComponentType<SettingsExposureButtonProps>;
  readonly Card: ComponentType<SettingsExposureCardProps>;
  readonly CardHeader: ComponentType<SettingsExposureCardSectionProps>;
  readonly CardTitle: ComponentType<SettingsExposureCardSectionProps>;
  readonly CardDescription: ComponentType<SettingsExposureCardSectionProps>;
  readonly CardContent: ComponentType<SettingsExposureCardSectionProps>;
  readonly Label: ComponentType<SettingsExposureLabelProps>;
  readonly Skeleton: ComponentType<SettingsExposureSkeletonProps>;
};

/** Generic exposure selection helpers (shell-owned; injected into package panel). */
export type SettingsExposureFieldSelectionState = {
  readonly customizeFields: boolean;
  readonly selectedFieldIds: readonly string[];
};

export type SettingsExposureSurfacesSelection = {
  readonly catalogFieldIdsFromExposureFields: (
    fields: readonly SettingsExposureSurfacesCatalogField[],
  ) => readonly string[];
  readonly toExposureChecklistFields: (
    fields: readonly SettingsExposureSurfacesCatalogField[],
  ) => readonly SettingsExposureFieldChecklistField[];
  readonly resolveEffectiveSelectedFieldIds: (
    state: SettingsExposureFieldSelectionState,
    catalogFieldIds: readonly string[],
  ) => readonly string[];
  readonly toggleExposureFieldSelection: (
    state: SettingsExposureFieldSelectionState,
    catalogFieldIds: readonly string[],
    fieldId: string,
    checked: boolean,
  ) => SettingsExposureFieldSelectionState;
  readonly setExposureCustomizeFields: (
    state: SettingsExposureFieldSelectionState,
    catalogFieldIds: readonly string[],
    customize: boolean,
  ) => SettingsExposureFieldSelectionState;
};

export type SettingsExposureSurfacesPanelProps = {
  readonly workspaceId: string;
  readonly exposureCandidateFields: readonly SettingsExposureSurfacesCatalogField[];
  readonly canEdit: boolean;
  readonly io: SettingsExposureSurfacesIo;
  readonly chrome: SettingsExposureSurfacesChrome;
  readonly selection: SettingsExposureSurfacesSelection;
};

export type SettingsExposureSurfacesUiSurface = {
  readonly WorkspaceSurfacesPanel: ComponentType<SettingsExposureSurfacesPanelProps>;
};
