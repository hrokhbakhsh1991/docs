import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { CreateEquipmentItemDto } from "./dto/create-equipment-item.dto";
import type { UpdateEquipmentItemDto } from "./dto/update-equipment-item.dto";
import { WorkspaceEquipmentItemResponseDto } from "./dto/workspace-equipment-item-response.dto";
import { WorkspaceEquipmentItemEntity } from "./entities/workspace-equipment-item.entity";

@Injectable()
export class EquipmentSettingsService {
  constructor(
    @InjectRepository(WorkspaceEquipmentItemEntity)
    private readonly equipmentRepository: Repository<WorkspaceEquipmentItemEntity>,
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

  private normalizeSlug(value: string): string {
    return String(value).trim();
  }

  private toResponse(row: WorkspaceEquipmentItemEntity): WorkspaceEquipmentItemResponseDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category ?? null,
      description: row.description ?? null,
      icon: row.icon ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async findAllByWorkspace(): Promise<WorkspaceEquipmentItemResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const rows = await this.equipmentRepository.find({
      where: { workspaceId },
      order: { sortOrder: "ASC", name: "ASC" }
    });
    return rows.map((r) => this.toResponse(r));
  }

  async create(dto: CreateEquipmentItemDto): Promise<WorkspaceEquipmentItemResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const slug = this.normalizeSlug(dto.slug);
    const exists = await this.equipmentRepository.exist({ where: { workspaceId, slug } });
    if (exists) {
      throw new ConflictException({
        error: { code: "EQUIPMENT_SLUG_CONFLICT", message: "An equipment item with this slug already exists" }
      });
    }
    const row = this.equipmentRepository.create({
      workspaceId,
      name: dto.name.trim(),
      slug,
      category: this.normalizeNullableText(dto.category),
      description: this.normalizeNullableText(dto.description),
      icon: this.normalizeNullableText(dto.icon),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0
    });
    const saved = await this.equipmentRepository.save(row);
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateEquipmentItemDto): Promise<WorkspaceEquipmentItemResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.equipmentRepository.findOne({ where: { id, workspaceId } });
    if (!row) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Equipment item not found" }
      });
    }
    const keys = Object.keys(dto) as (keyof UpdateEquipmentItemDto)[];
    if (keys.length === 0) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "No fields to update" }
      });
    }
    if (dto.slug !== undefined) {
      const nextSlug = this.normalizeSlug(dto.slug);
      if (nextSlug !== row.slug) {
        const taken = await this.equipmentRepository.exist({
          where: { workspaceId, slug: nextSlug }
        });
        if (taken) {
          throw new ConflictException({
            error: { code: "EQUIPMENT_SLUG_CONFLICT", message: "An equipment item with this slug already exists" }
          });
        }
        row.slug = nextSlug;
      }
    }
    if (dto.name !== undefined) {
      row.name = dto.name.trim();
    }
    if (dto.category !== undefined) {
      row.category = this.normalizeNullableText(dto.category);
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
    const saved = await this.equipmentRepository.save(row);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const res = await this.equipmentRepository.delete({ id, workspaceId });
    if (!res.affected) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Equipment item not found" }
      });
    }
  }

  /**
   * `itemIds` must list every equipment item id for the workspace exactly once (full permutation).
   */
  async reorder(itemIds: string[]): Promise<WorkspaceEquipmentItemResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const existing = await this.equipmentRepository.find({
      where: { workspaceId },
      select: { id: true }
    });
    const existingIds = new Set(existing.map((r) => r.id));
    if (existingIds.size !== itemIds.length) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FAILED",
          message: "itemIds must include every equipment item exactly once"
        }
      });
    }
    const seen = new Set<string>();
    for (const id of itemIds) {
      if (!existingIds.has(id) || seen.has(id)) {
        throw new BadRequestException({
          error: {
            code: "VALIDATION_FAILED",
            message: "itemIds must include every equipment item exactly once"
          }
        });
      }
      seen.add(id);
    }

    await this.equipmentRepository.manager.transaction(async (em) => {
      for (let i = 0; i < itemIds.length; i += 1) {
        await em.update(
          WorkspaceEquipmentItemEntity,
          { id: itemIds[i], workspaceId },
          { sortOrder: i }
        );
      }
    });

    return this.findAllByWorkspace();
  }
}
