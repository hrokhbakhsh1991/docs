import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import {
  WORKSPACE_SETTINGS_REPOSITORY_PORT,
  type WorkspaceSettingsRepositoryPort,
} from "./domain/ports/workspace-settings-repository.port";
import type { CreateGuideLanguageDto } from "./dto/create-guide-language.dto";
import type { UpdateGuideLanguageDto } from "./dto/update-guide-language.dto";
import { WorkspaceGuideLanguageResponseDto } from "./dto/workspace-guide-language-response.dto";
import { WorkspaceGuideLanguageEntity } from "./entities/workspace-guide-language.entity";

@Injectable()
export class GuideLanguagesSettingsService {
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

  private normalizeSlug(value: string): string {
    return String(value).trim();
  }

  private toResponse(row: WorkspaceGuideLanguageEntity): WorkspaceGuideLanguageResponseDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findAllByWorkspace(): Promise<WorkspaceGuideLanguageResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const rows = await this.settingsRepository.listGuideLanguages(workspaceId);
    return rows.map((r) => this.toResponse(r));
  }

  async create(dto: CreateGuideLanguageDto): Promise<WorkspaceGuideLanguageResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const slug = this.normalizeSlug(dto.slug);
    const exists = await this.settingsRepository.guideLanguageSlugExists(workspaceId, slug);
    if (exists) {
      throw new ConflictException({
        error: {
          code: "GUIDE_LANGUAGE_SLUG_CONFLICT",
          message: "A guide language with this slug already exists",
        },
      });
    }
    const row = this.settingsRepository.newGuideLanguage({
      workspaceId,
      name: dto.name.trim(),
      slug,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    const saved = await this.settingsRepository.saveGuideLanguage(row);
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateGuideLanguageDto): Promise<WorkspaceGuideLanguageResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.settingsRepository.findGuideLanguageById(workspaceId, id);
    if (!row) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Guide language not found" },
      });
    }
    const keys = Object.keys(dto) as (keyof UpdateGuideLanguageDto)[];
    if (keys.length === 0) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "No fields to update" },
      });
    }
    if (dto.slug !== undefined) {
      const nextSlug = this.normalizeSlug(dto.slug);
      if (nextSlug !== row.slug) {
        const taken = await this.settingsRepository.guideLanguageSlugExists(workspaceId, nextSlug);
        if (taken) {
          throw new ConflictException({
            error: {
              code: "GUIDE_LANGUAGE_SLUG_CONFLICT",
              message: "A guide language with this slug already exists",
            },
          });
        }
        row.slug = nextSlug;
      }
    }
    if (dto.name !== undefined) {
      row.name = dto.name.trim();
    }
    if (dto.isActive !== undefined) {
      row.isActive = dto.isActive;
    }
    if (dto.sortOrder !== undefined) {
      row.sortOrder = dto.sortOrder;
    }
    const saved = await this.settingsRepository.saveGuideLanguage(row);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const affected = await this.settingsRepository.deleteGuideLanguage(workspaceId, id);
    if (!affected) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Guide language not found" },
      });
    }
  }

  async reorder(itemIds: string[]): Promise<WorkspaceGuideLanguageResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const existing = await this.settingsRepository.listGuideLanguageIds(workspaceId);
    const existingIds = new Set(existing.map((r) => r.id));
    if (existingIds.size !== itemIds.length) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FAILED",
          message: "itemIds must include every guide language exactly once",
        },
      });
    }
    const seen = new Set<string>();
    for (const itemId of itemIds) {
      if (!existingIds.has(itemId) || seen.has(itemId)) {
        throw new BadRequestException({
          error: {
            code: "VALIDATION_FAILED",
            message: "itemIds must include every guide language exactly once",
          },
        });
      }
      seen.add(itemId);
    }

    await this.settingsRepository.reorderGuideLanguages(workspaceId, itemIds);

    return this.findAllByWorkspace();
  }
}
