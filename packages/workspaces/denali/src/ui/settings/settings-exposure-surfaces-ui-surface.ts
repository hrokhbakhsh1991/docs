import type { ComponentType, ReactNode } from "react";

/**
 * Denali host mirror of shell exposure-surfaces UI contract (H1.c.2.b).
 */

export type DenaliSettingsExposureSurfacesCatalogField = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly adminLabel?: string;
  readonly adminDescription?: string;
  readonly group?: string;
  readonly icon?: string;
};

export type DenaliSettingsExposureSurfaceDefinition = {
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

export type DenaliSettingsExposureSurfacesPatchInput = {
  readonly audience: string;
  readonly trigger: string;
  readonly enabled: boolean;
  readonly selectedFieldIds: readonly string[];
};

export type DenaliSettingsExposureSurfacesIo = {
  readonly loadSurfaces: (workspaceId: string) => Promise<{
    readonly surfaces: readonly DenaliSettingsExposureSurfaceDefinition[];
  }>;
  readonly saveSurfaceIntent: (
    workspaceId: string,
    surfaceKey: string,
    patch: DenaliSettingsExposureSurfacesPatchInput,
  ) => Promise<void>;
};

export type DenaliSettingsExposureCollapsibleSectionProps = {
  readonly title: string;
  readonly description?: string;
  readonly defaultOpen?: boolean;
  readonly badge?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export type DenaliSettingsExposureFieldChecklistContext = {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
};

export type DenaliSettingsExposureFieldChecklistField = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly adminLabel?: string;
  readonly adminDescription?: string;
  readonly group?: string;
  readonly icon?: string;
};

export type DenaliSettingsExposureFieldChecklistLabels = {
  readonly searchPlaceholder: string;
  readonly selectAllInGroup: string;
  readonly clearGroup: string;
  readonly selectedOfTotal: string;
};

export type DenaliSettingsExposureFieldChecklistProps = {
  readonly context: DenaliSettingsExposureFieldChecklistContext;
  readonly fields: readonly DenaliSettingsExposureFieldChecklistField[];
  readonly selectedFieldIds: readonly string[];
  readonly disabled?: boolean;
  readonly emptyLabel: string;
  readonly selectedSummary: string;
  readonly labels?: DenaliSettingsExposureFieldChecklistLabels;
  readonly onFieldToggle: (fieldId: string, checked: boolean) => void;
};

export type DenaliSettingsExposureBadgeProps = {
  readonly variant?: "default" | "outline";
  readonly className?: string;
  readonly children?: ReactNode;
};

export type DenaliSettingsExposureButtonProps = {
  readonly type?: "button" | "submit" | "reset";
  readonly size?: "sm" | "default" | "lg" | "icon";
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onClick?: () => void;
  readonly children?: ReactNode;
};

export type DenaliSettingsExposureCardProps = {
  readonly className?: string;
  readonly children?: ReactNode;
  readonly "data-testid"?: string;
  readonly "data-operator-surface"?: string;
};

export type DenaliSettingsExposureCardSectionProps = {
  readonly className?: string;
  readonly children?: ReactNode;
};

export type DenaliSettingsExposureLabelProps = {
  readonly htmlFor?: string;
  readonly className?: string;
  readonly children?: ReactNode;
};

export type DenaliSettingsExposureSkeletonProps = {
  readonly className?: string;
};

export type DenaliSettingsExposureSurfacesChrome = {
  readonly CollapsibleSection: ComponentType<DenaliSettingsExposureCollapsibleSectionProps>;
  readonly FieldChecklist: ComponentType<DenaliSettingsExposureFieldChecklistProps>;
  readonly Badge: ComponentType<DenaliSettingsExposureBadgeProps>;
  readonly Button: ComponentType<DenaliSettingsExposureButtonProps>;
  readonly Card: ComponentType<DenaliSettingsExposureCardProps>;
  readonly CardHeader: ComponentType<DenaliSettingsExposureCardSectionProps>;
  readonly CardTitle: ComponentType<DenaliSettingsExposureCardSectionProps>;
  readonly CardDescription: ComponentType<DenaliSettingsExposureCardSectionProps>;
  readonly CardContent: ComponentType<DenaliSettingsExposureCardSectionProps>;
  readonly Label: ComponentType<DenaliSettingsExposureLabelProps>;
  readonly Skeleton: ComponentType<DenaliSettingsExposureSkeletonProps>;
};

export type DenaliSettingsExposureFieldSelectionState = {
  readonly customizeFields: boolean;
  readonly selectedFieldIds: readonly string[];
};

export type DenaliSettingsExposureSurfacesSelection = {
  readonly catalogFieldIdsFromExposureFields: (
    fields: readonly DenaliSettingsExposureSurfacesCatalogField[],
  ) => readonly string[];
  readonly toExposureChecklistFields: (
    fields: readonly DenaliSettingsExposureSurfacesCatalogField[],
  ) => readonly DenaliSettingsExposureFieldChecklistField[];
  readonly resolveEffectiveSelectedFieldIds: (
    state: DenaliSettingsExposureFieldSelectionState,
    catalogFieldIds: readonly string[],
  ) => readonly string[];
  readonly toggleExposureFieldSelection: (
    state: DenaliSettingsExposureFieldSelectionState,
    catalogFieldIds: readonly string[],
    fieldId: string,
    checked: boolean,
  ) => DenaliSettingsExposureFieldSelectionState;
  readonly setExposureCustomizeFields: (
    state: DenaliSettingsExposureFieldSelectionState,
    catalogFieldIds: readonly string[],
    customize: boolean,
  ) => DenaliSettingsExposureFieldSelectionState;
};

export type DenaliSettingsExposureSurfacesPanelProps = {
  readonly workspaceId: string;
  readonly exposureCandidateFields: readonly DenaliSettingsExposureSurfacesCatalogField[];
  readonly canEdit: boolean;
  readonly io: DenaliSettingsExposureSurfacesIo;
  readonly chrome: DenaliSettingsExposureSurfacesChrome;
  readonly selection: DenaliSettingsExposureSurfacesSelection;
};

export type DenaliSettingsExposureSurfacesUiSurface = {
  readonly WorkspaceSurfacesPanel: ComponentType<DenaliSettingsExposureSurfacesPanelProps>;
};

export const DENALI_SETTINGS_EXPOSURE_SURFACES_UI_KEYS = Object.freeze({
  WorkspaceSurfacesPanel: "WorkspaceSurfacesPanel",
} as const);
