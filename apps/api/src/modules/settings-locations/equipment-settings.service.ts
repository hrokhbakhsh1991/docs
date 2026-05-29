import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { normalizeCompatibleCategories } from "@repo/denali-domain";

import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import {
  WORKSPACE_SETTINGS_REPOSITORY_PORT,
  type WorkspaceSettingsRepositoryPort,
} from "./domain/ports/workspace-settings-repository.port";
import type { CreateEquipmentItemDto } from "./dto/create-equipment-item.dto";
import type { UpdateEquipmentItemDto } from "./dto/update-equipment-item.dto";
import { WorkspaceEquipmentItemResponseDto } from "./dto/workspace-equipment-item-response.dto";
import { WorkspaceEquipmentItemEntity } from "./entities/workspace-equipment-item.entity";

@Injectable()
export class EquipmentSettingsService {
  constructor(
    @Inject(WORKSPACE_SETTINGS_REPOSITORY_PORT)
    private readonly settingsRepository: WorkspaceSettingsRepositoryPort,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
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

  private normalizeSlug(value: string): string {
    return String(value).trim();
  }

  private normalizeCompatibleCategoriesInput(values: string[] | undefined): string[] {
    return normalizeCompatibleCategories(values ?? []);
  }

  private toResponse(row: WorkspaceEquipmentItemEntity): WorkspaceEquipmentItemResponseDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      compatibleCategories: normalizeCompatibleCategories(row.compatibleCategories ?? []),
      description: row.description ?? null,
      icon: row.icon ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findAllByWorkspace(): Promise<WorkspaceEquipmentItemResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const rows = await this.settingsRepository.listEquipment(workspaceId);
    return rows.map((r) => this.toResponse(r));
  }

  async create(dto: CreateEquipmentItemDto): Promise<WorkspaceEquipmentItemResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const slug = this.normalizeSlug(dto.slug);
    const exists = await this.settingsRepository.equipmentSlugExists(workspaceId, slug);
    if (exists) {
      throw new ConflictException({
        error: {
          code: "EQUIPMENT_SLUG_CONFLICT",
          message: "An equipment item with this slug already exists",
        },
      });
    }
    const row = this.settingsRepository.newEquipment({
      workspaceId,
      name: dto.name.trim(),
      slug,
      compatibleCategories: this.normalizeCompatibleCategoriesInput(dto.compatibleCategories),
      description: this.normalizeNullableText(dto.description),
      icon: this.normalizeNullableText(dto.icon),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    const saved = await this.settingsRepository.saveEquipment(row);
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateEquipmentItemDto): Promise<WorkspaceEquipmentItemResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.settingsRepository.findEquipmentById(workspaceId, id);
    if (!row) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Equipment item not found" },
      });
    }
    const keys = Object.keys(dto) as (keyof UpdateEquipmentItemDto)[];
    if (keys.length === 0) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "No fields to update" },
      });
    }
    if (dto.slug !== undefined) {
      const nextSlug = this.normalizeSlug(dto.slug);
      if (nextSlug !== row.slug) {
        const taken = await this.settingsRepository.equipmentSlugExists(workspaceId, nextSlug);
        if (taken) {
          throw new ConflictException({
            error: {
              code: "EQUIPMENT_SLUG_CONFLICT",
              message: "An equipment item with this slug already exists",
            },
          });
        }
        row.slug = nextSlug;
      }
    }
    if (dto.name !== undefined) {
      row.name = dto.name.trim();
    }
    if (dto.compatibleCategories !== undefined) {
      row.compatibleCategories = this.normalizeCompatibleCategoriesInput(dto.compatibleCategories);
    }
    if (dto.description !== undefined) {
      row.description = this.normalizeNullableText(dto.description);
    }
    if (dto.icon !== undefined) {
      row.icon = this.normalizeNullableText(dto.icon);
    }
    if (dto.isActive !== undefined) {
      row.isActive = dto.isActive;
    }
    if (dto.sortOrder !== undefined) {
      row.sortOrder = dto.sortOrder;
    }
    const saved = await this.settingsRepository.saveEquipment(row);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const affected = await this.settingsRepository.deleteEquipment(workspaceId, id);
    if (!affected) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Equipment item not found" },
      });
    }
  }

  /**
   * `itemIds` must list every equipment item id for the workspace exactly once (full permutation).
   */
  async reorder(itemIds: string[]): Promise<WorkspaceEquipmentItemResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const existing = await this.settingsRepository.listEquipmentIds(workspaceId);
    const existingIds = new Set(existing.map((r) => r.id));
    if (existingIds.size !== itemIds.length) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FAILED",
          message: "itemIds must include every equipment item exactly once",
        },
      });
    }
    const seen = new Set<string>();
    for (const itemId of itemIds) {
      if (!existingIds.has(itemId) || seen.has(itemId)) {
        throw new BadRequestException({
          error: {
            code: "VALIDATION_FAILED",
            message: "itemIds must include every equipment item exactly once",
          },
        });
      }
      seen.add(itemId);
    }

    await this.settingsRepository.reorderEquipment(workspaceId, itemIds);

    return this.findAllByWorkspace();
  }
}
