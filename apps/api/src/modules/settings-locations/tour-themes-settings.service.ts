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
import type { CreateWorkspaceTourThemeDto } from "./dto/create-workspace-tour-theme.dto";
import type { UpdateWorkspaceTourThemeDto } from "./dto/update-workspace-tour-theme.dto";
import { WorkspaceTourThemeResponseDto } from "./dto/workspace-tour-theme-response.dto";
import { WorkspaceTourThemeEntity } from "./entities/workspace-tour-theme.entity";

@Injectable()
export class TourThemesSettingsService {
  constructor(
    @InjectRepository(WorkspaceTourThemeEntity)
    private readonly tourThemesRepository: Repository<WorkspaceTourThemeEntity>,
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

  private toResponse(row: WorkspaceTourThemeEntity): WorkspaceTourThemeResponseDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async findAllByWorkspace(): Promise<WorkspaceTourThemeResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const rows = await this.tourThemesRepository.find({
      where: { workspaceId },
      order: { sortOrder: "ASC", name: "ASC" }
    });
    return rows.map((r) => this.toResponse(r));
  }

  async create(dto: CreateWorkspaceTourThemeDto): Promise<WorkspaceTourThemeResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const slug = this.normalizeSlug(dto.slug);
    const exists = await this.tourThemesRepository.exist({ where: { workspaceId, slug } });
    if (exists) {
      throw new ConflictException({
        error: { code: "TOUR_THEME_SLUG_CONFLICT", message: "A tour theme with this slug already exists" }
      });
    }
    const row = this.tourThemesRepository.create({
      workspaceId,
      name: dto.name.trim(),
      slug,
      description: this.normalizeNullableText(dto.description),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0
    });
    const saved = await this.tourThemesRepository.save(row);
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateWorkspaceTourThemeDto): Promise<WorkspaceTourThemeResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.tourThemesRepository.findOne({ where: { id, workspaceId } });
    if (!row) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Tour theme not found" }
      });
    }
    const keys = Object.keys(dto) as (keyof UpdateWorkspaceTourThemeDto)[];
    if (keys.length === 0) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "No fields to update" }
      });
    }
    if (dto.slug !== undefined) {
      const nextSlug = this.normalizeSlug(dto.slug);
      if (nextSlug !== row.slug) {
        const taken = await this.tourThemesRepository.exist({
          where: { workspaceId, slug: nextSlug }
        });
        if (taken) {
          throw new ConflictException({
            error: { code: "TOUR_THEME_SLUG_CONFLICT", message: "A tour theme with this slug already exists" }
          });
        }
        row.slug = nextSlug;
      }
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
    const saved = await this.tourThemesRepository.save(row);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const res = await this.tourThemesRepository.delete({ id, workspaceId });
    if (!res.affected) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Tour theme not found" }
      });
    }
  }

  async reorder(itemIds: string[]): Promise<WorkspaceTourThemeResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const existing = await this.tourThemesRepository.find({
      where: { workspaceId },
      select: { id: true }
    });
    const existingIds = new Set(existing.map((r) => r.id));
    if (existingIds.size !== itemIds.length) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FAILED",
          message: "itemIds must include every tour theme id exactly once"
        }
      });
    }
    const seen = new Set<string>();
    for (const id of itemIds) {
      if (!existingIds.has(id) || seen.has(id)) {
        throw new BadRequestException({
          error: {
            code: "VALIDATION_FAILED",
            message: "itemIds must include every tour theme id exactly once"
          }
        });
      }
      seen.add(id);
    }

    await this.tourThemesRepository.manager.transaction(async (em) => {
      for (let i = 0; i < itemIds.length; i += 1) {
        await em.update(
          WorkspaceTourThemeEntity,
          { id: itemIds[i], workspaceId },
          { sortOrder: i }
        );
      }
    });

    return this.findAllByWorkspace();
  }
}
