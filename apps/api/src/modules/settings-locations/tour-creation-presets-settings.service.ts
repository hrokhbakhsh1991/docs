import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import {
  defaultTourFormProfileForTourType,
  normalizeTourFormProfileInput,
  type TourFormProfile,
  type TourType
} from "@repo/types";

import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { CreateWorkspaceTourCreationPresetDto } from "./dto/create-workspace-tour-creation-preset.dto";
import type { UpdateWorkspaceTourCreationPresetDto } from "./dto/update-workspace-tour-creation-preset.dto";
import { WorkspaceTourCreationPresetResponseDto } from "./dto/workspace-tour-creation-preset-response.dto";
import { WorkspaceTourCreationPresetEntity } from "./entities/workspace-tour-creation-preset.entity";
import { WorkspaceTourThemeEntity } from "./entities/workspace-tour-theme.entity";
import {
  detectPresetThemeProfileDrift,
  formatPresetDriftWarning,
  type ThemeLookup,
} from "./tour-preset-defaults-drift";
import {
  canonicalToTemplate,
  templateToCanonical,
  type DenaliCanonicalTemplateData,
} from "@repo/types/denali";

import { parseDenaliCanonicalTemplateDataOrThrow } from "./denali-canonical-template-data.schema";
import { parsePresetDefaultsOrThrow } from "./tour-preset-defaults.schema";
import { usesDenaliCanonicalTemplate } from "../tours/strategies/workspace.strategy.registry";
import {
  mergeLegacyMatchIntoDefaults,
  migrateGatheringPointsToLogisticsArray,
} from "./tour-preset-defaults-legacy";

import { AuditLogService } from "../../common/audit/audit-log.service";
import { AUDIT_CATEGORY } from "../../common/audit/audit-category";

const MAX_DEFAULTS_JSON_BYTES = 256 * 1024;

@Injectable()
export class TourCreationPresetsSettingsService {
  private readonly logger = new Logger(TourCreationPresetsSettingsService.name);

  constructor(
    @InjectRepository(WorkspaceTourCreationPresetEntity)
    private readonly presetsRepository: Repository<WorkspaceTourCreationPresetEntity>,
    @InjectRepository(WorkspaceTourThemeEntity)
    private readonly themesRepository: Repository<WorkspaceTourThemeEntity>,
    private readonly requestContext: RequestContextService,
    private readonly auditLogService: AuditLogService
  ) {}

  private resolveWorkspaceOrThrow(): string {
    const workspaceId = this.requestContext.resolveEffectiveTenantId();
    if (!workspaceId) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    const userId = this.requestContext.getUserId();
    if (!userId) {
      throw new ForbiddenException(authRequiredError());
    }
    return workspaceId;
  }

  private normalizeNullableText(value: string | null | undefined): string | null {
    if (value == null) {
      return null;
    }
    const t = String(value).trim();
    return t === "" ? null : t;
  }

  private normalizeOptionalMatchTourType(value: string | null | undefined): string | null {
    if (value == null) return null;
    const t = String(value).trim();
    return t === "" ? null : t;
  }

  private normalizeOptionalUuid(value: string | null | undefined): string | null {
    if (value == null) return null;
    const t = String(value).trim();
    return t === "" ? null : t;
  }

  private isDenaliFormProfile(formProfile: TourFormProfile): boolean {
    return usesDenaliCanonicalTemplate(formProfile);
  }

  private rejectDenaliLegacyDefaults(value: unknown): void {
    if (
      value != null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length > 0
    ) {
      throw new BadRequestException({
        error: {
          code: "DENALI_TEMPLATE_LEGACY_DEFAULTS_REJECTED",
          message: "Denali templates use canonicalData only; legacy defaults are not supported.",
        },
      });
    }
  }

  private assertCanonicalData(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "canonicalData must be a JSON object" },
      });
    }
    const encoded = JSON.stringify(value);
    if (encoded.length > MAX_DEFAULTS_JSON_BYTES) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FAILED",
          message: `canonicalData JSON must be at most ${MAX_DEFAULTS_JSON_BYTES} bytes`,
        },
      });
    }
    return parseDenaliCanonicalTemplateDataOrThrow(value) as Record<string, unknown>;
  }

  private assertPlainDefaults(
    value: unknown,
    formProfile: TourFormProfile,
  ): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "defaults must be a JSON object" }
      });
    }
    const encoded = JSON.stringify(value);
    if (encoded.length > MAX_DEFAULTS_JSON_BYTES) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FAILED",
          message: `defaults JSON must be at most ${MAX_DEFAULTS_JSON_BYTES} bytes`
        }
      });
    }
    const plain = value as Record<string, unknown>;
    parsePresetDefaultsOrThrow(plain, { formProfile });
    return plain;
  }

  /**
   * Soft drift diagnostic: looks up the workspace theme referenced by either
   * `defaults.overview.mainTourThemeId` or the legacy `matchMainTourThemeId`
   * column and compares its `formProfile` with `preset.formProfile`. Mismatch
   * is emitted as a `warn` log — the preset is **always saved** (Phase-2
   * policy "soft"). See `tour-preset-defaults-drift.ts` for the contract.
   */
  private async checkAndLogThemeProfileDrift(opts: {
    workspaceId: string;
    presetFormProfile: TourFormProfile | null | undefined;
    canonicalData?: Record<string, unknown>;
    defaults?: Record<string, unknown>;
    matchMainTourThemeId: string | null;
  }): Promise<void> {
    if (!opts.presetFormProfile) return;
    const program = opts.canonicalData?.program;
    const programThemeIds =
      program != null &&
      typeof program === "object" &&
      !Array.isArray(program) &&
      Array.isArray((program as { themeIds?: unknown }).themeIds)
        ? ((program as { themeIds: unknown[] }).themeIds.filter(
            (id): id is string => typeof id === "string" && id.trim() !== "",
          )[0] ?? null)
        : null;
    const overviewRaw = opts.defaults?.overview;
    const overview =
      overviewRaw && typeof overviewRaw === "object" && !Array.isArray(overviewRaw)
        ? (overviewRaw as Record<string, unknown>)
        : {};
    const defaultsOverviewMainTourThemeId =
      programThemeIds ??
      (typeof overview.mainTourThemeId === "string" ? overview.mainTourThemeId : null);

    const lookup: ThemeLookup = async (themeId) => {
      const theme = await this.themesRepository.findOne({
        where: { id: themeId, workspaceId: opts.workspaceId },
        select: { id: true, formProfile: true },
      });
      return theme ? { id: theme.id, formProfile: theme.formProfile } : null;
    };

    const result = await detectPresetThemeProfileDrift(
      {
        presetFormProfile: opts.presetFormProfile,
        defaultsOverviewMainTourThemeId,
        matchMainTourThemeId: opts.matchMainTourThemeId,
      },
      lookup,
    );
    const warning = formatPresetDriftWarning(result);
    if (warning) this.logger.warn(warning);
  }

  private toResponse(row: WorkspaceTourCreationPresetEntity): WorkspaceTourCreationPresetResponseDto {
    const formProfile = normalizeTourFormProfileInput(row.formProfile ?? "general");
    if (this.isDenaliFormProfile(formProfile)) {
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
        matchTourType: row.matchTourType ?? null,
        matchMainTourThemeId: row.matchMainTourThemeId ?? null,
        formProfile,
        canonicalData: templateToCanonical(row),
        defaults: {},
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    }
    const defaults =
      row.defaults && typeof row.defaults === "object" && !Array.isArray(row.defaults)
        ? (row.defaults as Record<string, unknown>)
        : {};
    const enrichedDefaults = mergeLegacyMatchIntoDefaults(
      defaults,
      row.matchTourType ?? null,
      row.matchMainTourThemeId ?? null,
    );
    const fullyEnriched = migrateGatheringPointsToLogisticsArray(enrichedDefaults);
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      matchTourType: row.matchTourType ?? null,
      matchMainTourThemeId: row.matchMainTourThemeId ?? null,
      formProfile,
      canonicalData: {},
      defaults: fullyEnriched,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findAllByWorkspace(): Promise<WorkspaceTourCreationPresetResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const rows = await this.presetsRepository.find({
      where: { workspaceId },
      order: { sortOrder: "ASC", name: "ASC" }
    });
    return rows.map((r) => this.toResponse(r));
  }

  async findOneById(id: string): Promise<WorkspaceTourCreationPresetResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.presetsRepository.findOne({ where: { id, workspaceId } });
    if (!row) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Tour creation preset not found" }
      });
    }
    return this.toResponse(row);
  }

  async create(dto: CreateWorkspaceTourCreationPresetDto): Promise<WorkspaceTourCreationPresetResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const matchTourType = this.normalizeOptionalMatchTourType(dto.matchTourType);
    const matchMainTourThemeId = this.normalizeOptionalUuid(dto.matchMainTourThemeId);
    const formProfile =
      dto.formProfile != null && String(dto.formProfile).trim() !== ""
        ? normalizeTourFormProfileInput(dto.formProfile)
        : defaultTourFormProfileForTourType(matchTourType as TourType | null);
    const denali = this.isDenaliFormProfile(formProfile);
    if (denali) {
      this.rejectDenaliLegacyDefaults(dto.defaults);
    }
    const canonicalPayload = denali
      ? canonicalToTemplate(
          this.assertCanonicalData(dto.canonicalData ?? {}) as DenaliCanonicalTemplateData,
          { name: dto.name.trim(), formProfile },
        ).canonicalData
      : ({} as DenaliCanonicalTemplateData);
    const defaults = denali
      ? {}
      : this.assertPlainDefaults(dto.defaults ?? {}, formProfile);

    const row = this.presetsRepository.create({
      workspaceId,
      name: dto.name.trim(),
      description: this.normalizeNullableText(dto.description),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      matchTourType,
      matchMainTourThemeId,
      formProfile,
      canonicalData: canonicalPayload,
      defaults,
    });
    await this.checkAndLogThemeProfileDrift({
      workspaceId,
      presetFormProfile: formProfile,
      canonicalData: canonicalPayload as Record<string, unknown>,
      defaults,
      matchMainTourThemeId,
    });
    const saved = await this.presetsRepository.save(row);
    void this.auditLogService.logEvent({
      category: AUDIT_CATEGORY.SECURITY,
      action: "preset.create",
      entity: "preset",
      entityId: saved.id,
      after: { name: saved.name, formProfile: saved.formProfile },
    });
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateWorkspaceTourCreationPresetDto): Promise<WorkspaceTourCreationPresetResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.presetsRepository.findOne({ where: { id, workspaceId } });
    if (!row) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Tour creation preset not found" }
      });
    }
    const keys = Object.keys(dto) as (keyof UpdateWorkspaceTourCreationPresetDto)[];
    if (keys.length === 0) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "No fields to update" }
      });
    }

    if (dto.name !== undefined) {
      row.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      row.description = this.normalizeNullableText(dto.description);
    }
    if (dto.isActive !== undefined) {
      row.isActive = dto.isActive;
    }
    if (dto.sortOrder !== undefined) {
      row.sortOrder = dto.sortOrder;
    }
    const formProfile = normalizeTourFormProfileInput(row.formProfile ?? "general");
    if (dto.canonicalData !== undefined) {
      row.canonicalData = this.assertCanonicalData(dto.canonicalData);
    }
    if (dto.defaults !== undefined) {
      if (this.isDenaliFormProfile(normalizeTourFormProfileInput(row.formProfile ?? "general"))) {
        this.rejectDenaliLegacyDefaults(dto.defaults);
        row.defaults = {};
      } else {
        row.defaults = this.assertPlainDefaults(dto.defaults, formProfile);
      }
    }
    if (dto.matchTourType !== undefined) {
      row.matchTourType = this.normalizeOptionalMatchTourType(dto.matchTourType);
    }
    if (dto.matchMainTourThemeId !== undefined) {
      row.matchMainTourThemeId = this.normalizeOptionalUuid(dto.matchMainTourThemeId);
    }
    if (dto.formProfile !== undefined) {
      row.formProfile =
        dto.formProfile == null || String(dto.formProfile).trim() === ""
          ? "general"
          : normalizeTourFormProfileInput(dto.formProfile);
    }

    if (
      dto.canonicalData !== undefined ||
      dto.defaults !== undefined ||
      dto.formProfile !== undefined ||
      dto.matchMainTourThemeId !== undefined
    ) {
      await this.checkAndLogThemeProfileDrift({
        workspaceId,
        presetFormProfile: row.formProfile,
        canonicalData: row.canonicalData as Record<string, unknown>,
        defaults: row.defaults,
        matchMainTourThemeId: row.matchMainTourThemeId,
      });
    }
    const saved = await this.presetsRepository.save(row);
    void this.auditLogService.logEvent({
      category: AUDIT_CATEGORY.SECURITY,
      action: "preset.update",
      entity: "preset",
      entityId: saved.id,
      after: { name: saved.name, formProfile: saved.formProfile },
    });
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.presetsRepository.findOne({ where: { id, workspaceId } });
    if (!row) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Tour creation preset not found" }
      });
    }
    const res = await this.presetsRepository.delete({ id, workspaceId });
    if (!res.affected) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Tour creation preset not found" }
      });
    }
    await this.auditLogService.logEvent({
      category: AUDIT_CATEGORY.SECURITY,
      action: "preset.delete",
      entity: "preset",
      entityId: id,
      before: { name: row.name, formProfile: row.formProfile },
    });
  }

  async reorder(itemIds: string[]): Promise<WorkspaceTourCreationPresetResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const existing = await this.presetsRepository.find({
      where: { workspaceId },
      select: { id: true }
    });
    const existingIds = new Set(existing.map((r) => r.id));
    if (existingIds.size !== itemIds.length) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FAILED",
          message: "itemIds must include every tour creation preset id exactly once"
        }
      });
    }
    const seen = new Set<string>();
    for (const pid of itemIds) {
      if (!existingIds.has(pid) || seen.has(pid)) {
        throw new BadRequestException({
          error: {
            code: "VALIDATION_FAILED",
            message: "itemIds must include every tour creation preset id exactly once"
          }
        });
      }
      seen.add(pid);
    }

    await this.presetsRepository.manager.transaction(async (em) => {
      for (let i = 0; i < itemIds.length; i += 1) {
        await em.update(
          WorkspaceTourCreationPresetEntity,
          { id: itemIds[i], workspaceId },
          { sortOrder: i }
        );
      }
    });

    return this.findAllByWorkspace();
  }
}
