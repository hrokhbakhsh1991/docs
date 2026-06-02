/**
 * TypeORM adapter for {@link WorkspaceSettingsRepositoryPort}.
 * This is the only settings-locations module file allowed to import `@nestjs/typeorm` / `typeorm` for catalog persistence.
 */
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  DEFAULT_TOUR_FORM_PROFILE,
  normalizeTourFormProfileInput,
} from "@repo/types";
import type { DeepPartial } from "typeorm";
import { In, Repository } from "typeorm";

import type {
  WorkspaceSettingsRepositoryPort,
  WorkspaceTourFormProfileResolution,
} from "../domain/ports/workspace-settings-repository.port";
import { WorkspaceDestinationEntity } from "../entities/workspace-destination.entity";
import { WorkspaceEquipmentItemEntity } from "../entities/workspace-equipment-item.entity";
import { WorkspaceGuideLanguageEntity } from "../entities/workspace-guide-language.entity";
import { WorkspaceRegionEntity } from "../entities/workspace-region.entity";
import { WorkspaceTourCreationPresetEntity } from "../entities/workspace-tour-creation-preset.entity";
import { WorkspaceTourThemeEntity } from "../entities/workspace-tour-theme.entity";
import { WorkspaceTourWizardTemplateEntity } from "../entities/workspace-tour-wizard-template.entity";

const logger = new Logger("TypeOrmWorkspaceSettingsRepository");

@Injectable()
export class TypeOrmWorkspaceSettingsRepository implements WorkspaceSettingsRepositoryPort {
  constructor(
    @InjectRepository(WorkspaceRegionEntity)
    private readonly regionRepository: Repository<WorkspaceRegionEntity>,
    @InjectRepository(WorkspaceDestinationEntity)
    private readonly destinationRepository: Repository<WorkspaceDestinationEntity>,
    @InjectRepository(WorkspaceEquipmentItemEntity)
    private readonly equipmentRepository: Repository<WorkspaceEquipmentItemEntity>,
    @InjectRepository(WorkspaceGuideLanguageEntity)
    private readonly guideLanguageRepository: Repository<WorkspaceGuideLanguageEntity>,
    @InjectRepository(WorkspaceTourThemeEntity)
    private readonly tourThemeRepository: Repository<WorkspaceTourThemeEntity>,
    @InjectRepository(WorkspaceTourWizardTemplateEntity)
    private readonly tourWizardTemplateRepository: Repository<WorkspaceTourWizardTemplateEntity>,
    @InjectRepository(WorkspaceTourCreationPresetEntity)
    private readonly tourCreationPresetRepository: Repository<WorkspaceTourCreationPresetEntity>,
  ) {}

  async listRegions(tenantId: string): Promise<WorkspaceRegionEntity[]> {
    return this.regionRepository.find({
      where: { tenantId },
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  newRegion(data: DeepPartial<WorkspaceRegionEntity>): WorkspaceRegionEntity {
    return this.regionRepository.create(data);
  }

  saveRegion(row: WorkspaceRegionEntity): Promise<WorkspaceRegionEntity> {
    return this.regionRepository.save(row);
  }

  findRegionById(tenantId: string, regionId: string): Promise<WorkspaceRegionEntity | null> {
    return this.regionRepository.findOne({ where: { id: regionId, tenantId } });
  }

  async deleteRegion(tenantId: string, regionId: string): Promise<number> {
    const res = await this.regionRepository.delete({ id: regionId, tenantId });
    return res.affected ?? 0;
  }

  regionExists(tenantId: string, regionId: string): Promise<boolean> {
    return this.regionRepository.exist({ where: { id: regionId, tenantId } });
  }

  async listDestinations(tenantId: string): Promise<WorkspaceDestinationEntity[]> {
    return this.destinationRepository.find({
      where: { tenantId },
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  newDestination(data: DeepPartial<WorkspaceDestinationEntity>): WorkspaceDestinationEntity {
    return this.destinationRepository.create(data);
  }

  saveDestination(row: WorkspaceDestinationEntity): Promise<WorkspaceDestinationEntity> {
    return this.destinationRepository.save(row);
  }

  findDestinationById(
    tenantId: string,
    destinationId: string,
  ): Promise<WorkspaceDestinationEntity | null> {
    return this.destinationRepository.findOne({ where: { id: destinationId, tenantId } });
  }

  async deleteDestination(tenantId: string, destinationId: string): Promise<number> {
    const res = await this.destinationRepository.delete({ id: destinationId, tenantId });
    return res.affected ?? 0;
  }

  async listEquipment(workspaceId: string): Promise<WorkspaceEquipmentItemEntity[]> {
    return this.equipmentRepository.find({
      where: { workspaceId },
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  listEquipmentIds(workspaceId: string): Promise<Array<{ id: string }>> {
    return this.equipmentRepository.find({
      where: { workspaceId },
      select: { id: true },
    });
  }

  equipmentSlugExists(workspaceId: string, slug: string): Promise<boolean> {
    return this.equipmentRepository.exist({ where: { workspaceId, slug } });
  }

  newEquipment(data: DeepPartial<WorkspaceEquipmentItemEntity>): WorkspaceEquipmentItemEntity {
    return this.equipmentRepository.create(data);
  }

  saveEquipment(row: WorkspaceEquipmentItemEntity): Promise<WorkspaceEquipmentItemEntity> {
    return this.equipmentRepository.save(row);
  }

  findEquipmentById(
    workspaceId: string,
    id: string,
  ): Promise<WorkspaceEquipmentItemEntity | null> {
    return this.equipmentRepository.findOne({ where: { id, workspaceId } });
  }

  async deleteEquipment(workspaceId: string, id: string): Promise<number> {
    const res = await this.equipmentRepository.delete({ id, workspaceId });
    return res.affected ?? 0;
  }

  async reorderEquipment(workspaceId: string, orderedIds: string[]): Promise<void> {
    await this.equipmentRepository.manager.transaction(async (em) => {
      for (let i = 0; i < orderedIds.length; i += 1) {
        await em.update(
          WorkspaceEquipmentItemEntity,
          { id: orderedIds[i], workspaceId },
          { sortOrder: i },
        );
      }
    });
  }

  async listGuideLanguages(workspaceId: string): Promise<WorkspaceGuideLanguageEntity[]> {
    return this.guideLanguageRepository.find({
      where: { workspaceId },
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  listGuideLanguageIds(workspaceId: string): Promise<Array<{ id: string }>> {
    return this.guideLanguageRepository.find({
      where: { workspaceId },
      select: { id: true },
    });
  }

  guideLanguageSlugExists(workspaceId: string, slug: string): Promise<boolean> {
    return this.guideLanguageRepository.exist({ where: { workspaceId, slug } });
  }

  newGuideLanguage(
    data: DeepPartial<WorkspaceGuideLanguageEntity>,
  ): WorkspaceGuideLanguageEntity {
    return this.guideLanguageRepository.create(data);
  }

  saveGuideLanguage(row: WorkspaceGuideLanguageEntity): Promise<WorkspaceGuideLanguageEntity> {
    return this.guideLanguageRepository.save(row);
  }

  findGuideLanguageById(
    workspaceId: string,
    id: string,
  ): Promise<WorkspaceGuideLanguageEntity | null> {
    return this.guideLanguageRepository.findOne({ where: { id, workspaceId } });
  }

  async deleteGuideLanguage(workspaceId: string, id: string): Promise<number> {
    const res = await this.guideLanguageRepository.delete({ id, workspaceId });
    return res.affected ?? 0;
  }

  async reorderGuideLanguages(workspaceId: string, orderedIds: string[]): Promise<void> {
    await this.guideLanguageRepository.manager.transaction(async (em) => {
      for (let i = 0; i < orderedIds.length; i += 1) {
        await em.update(
          WorkspaceGuideLanguageEntity,
          { id: orderedIds[i], workspaceId },
          { sortOrder: i },
        );
      }
    });
  }

  async listTourThemes(workspaceId: string): Promise<WorkspaceTourThemeEntity[]> {
    return this.tourThemeRepository.find({
      where: { workspaceId },
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  listTourThemeIds(workspaceId: string): Promise<Array<{ id: string }>> {
    return this.tourThemeRepository.find({
      where: { workspaceId },
      select: { id: true },
    });
  }

  tourThemeSlugExists(workspaceId: string, slug: string): Promise<boolean> {
    return this.tourThemeRepository.exist({ where: { workspaceId, slug } });
  }

  newTourTheme(data: DeepPartial<WorkspaceTourThemeEntity>): WorkspaceTourThemeEntity {
    return this.tourThemeRepository.create(data);
  }

  saveTourTheme(row: WorkspaceTourThemeEntity): Promise<WorkspaceTourThemeEntity> {
    return this.tourThemeRepository.save(row);
  }

  findTourThemeById(workspaceId: string, id: string): Promise<WorkspaceTourThemeEntity | null> {
    return this.tourThemeRepository.findOne({ where: { id, workspaceId } });
  }

  findTourThemeFormProfileById(
    workspaceId: string,
    themeId: string,
  ): Promise<Pick<WorkspaceTourThemeEntity, "id" | "formProfile"> | null> {
    return this.tourThemeRepository.findOne({
      where: { id: themeId, workspaceId },
      select: { id: true, formProfile: true },
    });
  }

  async deleteTourTheme(workspaceId: string, id: string): Promise<number> {
    const res = await this.tourThemeRepository.delete({ id, workspaceId });
    return res.affected ?? 0;
  }

  async reorderTourThemes(workspaceId: string, orderedIds: string[]): Promise<void> {
    await this.tourThemeRepository.manager.transaction(async (em) => {
      for (let i = 0; i < orderedIds.length; i += 1) {
        await em.update(
          WorkspaceTourThemeEntity,
          { id: orderedIds[i], workspaceId },
          { sortOrder: i },
        );
      }
    });
  }

  findTourWizardTemplateByWorkspace(
    workspaceId: string,
  ): Promise<WorkspaceTourWizardTemplateEntity | null> {
    return this.tourWizardTemplateRepository.findOne({ where: { workspaceId } });
  }

  saveTourWizardTemplate(
    row: WorkspaceTourWizardTemplateEntity,
  ): Promise<WorkspaceTourWizardTemplateEntity> {
    return this.tourWizardTemplateRepository.save(row);
  }

  async listTourCreationPresets(workspaceId: string): Promise<WorkspaceTourCreationPresetEntity[]> {
    return this.tourCreationPresetRepository.find({
      where: { workspaceId },
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  listTourCreationPresetIds(workspaceId: string): Promise<Array<{ id: string }>> {
    return this.tourCreationPresetRepository.find({
      where: { workspaceId },
      select: { id: true },
    });
  }

  newTourCreationPreset(
    data: DeepPartial<WorkspaceTourCreationPresetEntity>,
  ): WorkspaceTourCreationPresetEntity {
    return this.tourCreationPresetRepository.create(data);
  }

  saveTourCreationPreset(
    row: WorkspaceTourCreationPresetEntity,
  ): Promise<WorkspaceTourCreationPresetEntity> {
    return this.tourCreationPresetRepository.save(row);
  }

  findTourCreationPresetById(
    workspaceId: string,
    id: string,
  ): Promise<WorkspaceTourCreationPresetEntity | null> {
    return this.tourCreationPresetRepository.findOne({ where: { id, workspaceId } });
  }

  async deleteTourCreationPreset(workspaceId: string, id: string): Promise<number> {
    const res = await this.tourCreationPresetRepository.delete({ id, workspaceId });
    return res.affected ?? 0;
  }

  async reorderTourCreationPresets(workspaceId: string, orderedIds: string[]): Promise<void> {
    await this.tourCreationPresetRepository.manager.transaction(async (em) => {
      for (let i = 0; i < orderedIds.length; i += 1) {
        await em.update(
          WorkspaceTourCreationPresetEntity,
          { id: orderedIds[i], workspaceId },
          { sortOrder: i },
        );
      }
    });
  }

  async findDestinationSummary(
    tenantId: string,
    destinationId: string,
  ): Promise<{ id: string; regionId: string | null } | null> {
    const row = await this.destinationRepository.findOne({
      where: { id: destinationId, tenantId },
      select: { id: true, regionId: true },
    });
    if (!row) {
      return null;
    }
    return { id: row.id, regionId: row.regionId ?? null };
  }

  async findExistingEquipmentIds(workspaceId: string, ids: readonly string[]): Promise<string[]> {
    const unique = [...new Set(ids)].filter((id) => id.trim().length > 0);
    if (unique.length === 0) {
      return [];
    }
    const rows = await this.equipmentRepository.find({
      where: { workspaceId, id: In(unique) },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async findExistingTourThemeIds(workspaceId: string, ids: readonly string[]): Promise<string[]> {
    const unique = [...new Set(ids)].filter((id) => id.trim().length > 0);
    if (unique.length === 0) {
      return [];
    }
    const rows = await this.tourThemeRepository.find({
      where: { workspaceId, id: In(unique) },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async findExistingGuideLanguageIds(workspaceId: string, ids: readonly string[]): Promise<string[]> {
    const unique = [...new Set(ids)].filter((id) => id.trim().length > 0);
    if (unique.length === 0) {
      return [];
    }
    const rows = await this.guideLanguageRepository.find({
      where: { workspaceId, id: In(unique) },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async resolveTourFormProfile(
    workspaceId: string,
    presetId?: string | null,
  ): Promise<WorkspaceTourFormProfileResolution> {
    if (presetId) {
      const preset = await this.tourCreationPresetRepository.findOne({
        where: { id: presetId, workspaceId },
        select: { formProfile: true },
      });
      if (preset) {
        return {
          profile: normalizeTourFormProfileInput(preset.formProfile),
          source: "selected_preset",
        };
      }
    }

    const row = await this.tourWizardTemplateRepository.findOne({
      where: { workspaceId },
      select: { baseProfile: true },
    });

    if (!row) {
      logger.warn(
        `No workspace_tour_wizard_templates row for workspaceId=${workspaceId}; using ${DEFAULT_TOUR_FORM_PROFILE}.`,
      );
      return {
        profile: DEFAULT_TOUR_FORM_PROFILE,
        source: "workspace_template_missing",
      };
    }

    return {
      profile: normalizeTourFormProfileInput(row.baseProfile),
      source: "workspace_template",
    };
  }
}
