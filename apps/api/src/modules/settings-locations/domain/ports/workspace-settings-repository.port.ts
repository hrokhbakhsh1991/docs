import type { TourFormProfile } from "@repo/types";
import type { DeepPartial } from "typeorm";

import type {
  WorkspaceDestinationRecord,
  WorkspaceEquipmentItemRecord,
  WorkspaceGuideLanguageRecord,
  WorkspaceRegionRecord,
  WorkspaceTourCreationPresetRecord,
  WorkspaceTourThemeRecord,
  WorkspaceTourWizardTemplateRecord,
} from "../workspace-catalog.records";

export const WORKSPACE_SETTINGS_REPOSITORY_PORT = Symbol("WORKSPACE_SETTINGS_REPOSITORY_PORT");

export type WorkspaceDestinationSummary = {
  id: string;
  regionId: string | null;
};

export type WorkspaceTourFormProfileResolutionSource =
  | "workspace_template"
  | "workspace_template_missing"
  | "selected_preset";

export type WorkspaceTourFormProfileResolution = {
  profile: TourFormProfile;
  source: WorkspaceTourFormProfileResolutionSource;
};

/**
 * Persistence port for workspace settings / locations catalogs.
 * Application services depend on this interface; TypeORM lives only in adapters.
 *
 * **TypeORM policy (Phase 4):** `import type` from `typeorm` is permitted in port interfaces — see MAP §61.
 */
export interface WorkspaceSettingsRepositoryPort {
  // —— Regions ——
  listRegions(tenantId: string): Promise<WorkspaceRegionRecord[]>;
  newRegion(data: DeepPartial<WorkspaceRegionRecord>): WorkspaceRegionRecord;
  saveRegion(row: WorkspaceRegionRecord): Promise<WorkspaceRegionRecord>;
  findRegionById(tenantId: string, regionId: string): Promise<WorkspaceRegionRecord | null>;
  deleteRegion(tenantId: string, regionId: string): Promise<number>;
  regionExists(tenantId: string, regionId: string): Promise<boolean>;

  // —— Destinations ——
  listDestinations(tenantId: string): Promise<WorkspaceDestinationRecord[]>;
  newDestination(data: DeepPartial<WorkspaceDestinationRecord>): WorkspaceDestinationRecord;
  saveDestination(row: WorkspaceDestinationRecord): Promise<WorkspaceDestinationRecord>;
  findDestinationById(
    tenantId: string,
    destinationId: string,
  ): Promise<WorkspaceDestinationRecord | null>;
  deleteDestination(tenantId: string, destinationId: string): Promise<number>;

  // —— Equipment ——
  listEquipment(workspaceId: string): Promise<WorkspaceEquipmentItemRecord[]>;
  listEquipmentIds(workspaceId: string): Promise<Array<{ id: string }>>;
  equipmentSlugExists(workspaceId: string, slug: string): Promise<boolean>;
  newEquipment(data: DeepPartial<WorkspaceEquipmentItemRecord>): WorkspaceEquipmentItemRecord;
  saveEquipment(row: WorkspaceEquipmentItemRecord): Promise<WorkspaceEquipmentItemRecord>;
  findEquipmentById(
    workspaceId: string,
    id: string,
  ): Promise<WorkspaceEquipmentItemRecord | null>;
  deleteEquipment(workspaceId: string, id: string): Promise<number>;
  reorderEquipment(workspaceId: string, orderedIds: string[]): Promise<void>;

  // —— Guide languages ——
  listGuideLanguages(workspaceId: string): Promise<WorkspaceGuideLanguageRecord[]>;
  listGuideLanguageIds(workspaceId: string): Promise<Array<{ id: string }>>;
  guideLanguageSlugExists(workspaceId: string, slug: string): Promise<boolean>;
  newGuideLanguage(data: DeepPartial<WorkspaceGuideLanguageRecord>): WorkspaceGuideLanguageRecord;
  saveGuideLanguage(row: WorkspaceGuideLanguageRecord): Promise<WorkspaceGuideLanguageRecord>;
  findGuideLanguageById(
    workspaceId: string,
    id: string,
  ): Promise<WorkspaceGuideLanguageRecord | null>;
  deleteGuideLanguage(workspaceId: string, id: string): Promise<number>;
  reorderGuideLanguages(workspaceId: string, orderedIds: string[]): Promise<void>;

  // —— Tour themes ——
  listTourThemes(workspaceId: string): Promise<WorkspaceTourThemeRecord[]>;
  listTourThemeIds(workspaceId: string): Promise<Array<{ id: string }>>;
  tourThemeSlugExists(workspaceId: string, slug: string): Promise<boolean>;
  newTourTheme(data: DeepPartial<WorkspaceTourThemeRecord>): WorkspaceTourThemeRecord;
  saveTourTheme(row: WorkspaceTourThemeRecord): Promise<WorkspaceTourThemeRecord>;
  findTourThemeById(workspaceId: string, id: string): Promise<WorkspaceTourThemeRecord | null>;
  findTourThemeFormProfileById(
    workspaceId: string,
    themeId: string,
  ): Promise<Pick<WorkspaceTourThemeRecord, "id" | "formProfile"> | null>;
  deleteTourTheme(workspaceId: string, id: string): Promise<number>;
  reorderTourThemes(workspaceId: string, orderedIds: string[]): Promise<void>;

  // —— Tour wizard template ——
  findTourWizardTemplateByWorkspace(
    workspaceId: string,
  ): Promise<WorkspaceTourWizardTemplateRecord | null>;
  saveTourWizardTemplate(
    row: WorkspaceTourWizardTemplateRecord,
  ): Promise<WorkspaceTourWizardTemplateRecord>;

  // —— Tour creation presets ——
  listTourCreationPresets(workspaceId: string): Promise<WorkspaceTourCreationPresetRecord[]>;
  listTourCreationPresetIds(workspaceId: string): Promise<Array<{ id: string }>>;
  newTourCreationPreset(
    data: DeepPartial<WorkspaceTourCreationPresetRecord>,
  ): WorkspaceTourCreationPresetRecord;
  saveTourCreationPreset(
    row: WorkspaceTourCreationPresetRecord,
  ): Promise<WorkspaceTourCreationPresetRecord>;
  findTourCreationPresetById(
    workspaceId: string,
    id: string,
  ): Promise<WorkspaceTourCreationPresetRecord | null>;
  deleteTourCreationPreset(workspaceId: string, id: string): Promise<number>;
  reorderTourCreationPresets(workspaceId: string, orderedIds: string[]): Promise<void>;

  findDestinationSummary(
    tenantId: string,
    destinationId: string,
  ): Promise<WorkspaceDestinationSummary | null>;

  findExistingEquipmentIds(workspaceId: string, ids: readonly string[]): Promise<string[]>;

  findExistingTourThemeIds(workspaceId: string, ids: readonly string[]): Promise<string[]>;

  findExistingGuideLanguageIds(workspaceId: string, ids: readonly string[]): Promise<string[]>;

  resolveTourFormProfile(
    workspaceId: string,
    presetId?: string | null,
  ): Promise<WorkspaceTourFormProfileResolution>;
}
