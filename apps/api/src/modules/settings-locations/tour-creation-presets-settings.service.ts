import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { CreateWorkspaceTourCreationPresetDto } from "./dto/create-workspace-tour-creation-preset.dto";
import type { UpdateWorkspaceTourCreationPresetDto } from "./dto/update-workspace-tour-creation-preset.dto";
import { WorkspaceTourCreationPresetResponseDto } from "./dto/workspace-tour-creation-preset-response.dto";
import { WorkspaceTourCreationPresetEntity } from "./entities/workspace-tour-creation-preset.entity";
import { mergeLegacyMatchIntoDefaults } from "./tour-preset-defaults-legacy";

const MAX_DEFAULTS_JSON_BYTES = 256 * 1024;

@Injectable()
export class TourCreationPresetsSettingsService {
  constructor(
    @InjectRepository(WorkspaceTourCreationPresetEntity)
    private readonly presetsRepository: Repository<WorkspaceTourCreationPresetEntity>,
    private readonly requestContext: RequestContextService
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

  private assertPlainDefaults(value: unknown): Record<string, unknown> {
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
    return value as Record<string, unknown>;
  }

  private toResponse(row: WorkspaceTourCreationPresetEntity): WorkspaceTourCreationPresetResponseDto {
    const defaults =
      row.defaults && typeof row.defaults === "object" && !Array.isArray(row.defaults)
        ? (row.defaults as Record<string, unknown>)
        : {};
    const enrichedDefaults = mergeLegacyMatchIntoDefaults(
      defaults,
      row.matchTourType ?? null,
      row.matchMainTourThemeId ?? null,
    );
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      matchTourType: null,
      matchMainTourThemeId: null,
      defaults: enrichedDefaults,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
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

  async create(dto: CreateWorkspaceTourCreationPresetDto): Promise<WorkspaceTourCreationPresetResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const defaults = this.assertPlainDefaults(dto.defaults ?? {});

    const row = this.presetsRepository.create({
      workspaceId,
      name: dto.name.trim(),
      description: this.normalizeNullableText(dto.description),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      matchTourType: null,
      matchMainTourThemeId: null,
      defaults
    });
    const saved = await this.presetsRepository.save(row);
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
    if (dto.defaults !== undefined) {
      row.defaults = this.assertPlainDefaults(dto.defaults);
    }

    row.matchTourType = null;
    row.matchMainTourThemeId = null;

    const saved = await this.presetsRepository.save(row);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const res = await this.presetsRepository.delete({ id, workspaceId });
    if (!res.affected) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Tour creation preset not found" }
      });
    }
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
