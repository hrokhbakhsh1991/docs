import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { normalizeTourFormProfileInput } from "@repo/types";

import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import {
  WORKSPACE_SETTINGS_REPOSITORY_PORT,
  type WorkspaceSettingsRepositoryPort,
} from "./domain/ports/workspace-settings-repository.port";
import type { CreateWorkspaceTourThemeDto } from "./dto/create-workspace-tour-theme.dto";
import type { UpdateWorkspaceTourThemeDto } from "./dto/update-workspace-tour-theme.dto";
import { WorkspaceTourThemeResponseDto } from "./dto/workspace-tour-theme-response.dto";
import { WorkspaceTourThemeEntity } from "./entities/workspace-tour-theme.entity";

@Injectable()
export class TourThemesSettingsService {
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

  private toResponse(row: WorkspaceTourThemeEntity): WorkspaceTourThemeResponseDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      formProfile: normalizeTourFormProfileInput(row.formProfile),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findAllByWorkspace(): Promise<WorkspaceTourThemeResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const rows = await this.settingsRepository.listTourThemes(workspaceId);
    return rows.map((r) => this.toResponse(r));
  }

  async create(dto: CreateWorkspaceTourThemeDto): Promise<WorkspaceTourThemeResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const slug = this.normalizeSlug(dto.slug);
    const exists = await this.settingsRepository.tourThemeSlugExists(workspaceId, slug);
    if (exists) {
      throw new ConflictException({
        error: { code: "TOUR_THEME_SLUG_CONFLICT", message: "A tour theme with this slug already exists" },
      });
    }
    const row = this.settingsRepository.newTourTheme({
      workspaceId,
      name: dto.name.trim(),
      slug,
      description: this.normalizeNullableText(dto.description),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      formProfile: normalizeTourFormProfileInput(dto.formProfile),
    });
    const saved = await this.settingsRepository.saveTourTheme(row);
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateWorkspaceTourThemeDto): Promise<WorkspaceTourThemeResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.settingsRepository.findTourThemeById(workspaceId, id);
    if (!row) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Tour theme not found" },
      });
    }
    const keys = Object.keys(dto) as (keyof UpdateWorkspaceTourThemeDto)[];
    if (keys.length === 0) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "No fields to update" },
      });
    }
    if (dto.slug !== undefined) {
      const nextSlug = this.normalizeSlug(dto.slug);
      if (nextSlug !== row.slug) {
        const taken = await this.settingsRepository.tourThemeSlugExists(workspaceId, nextSlug);
        if (taken) {
          throw new ConflictException({
            error: {
              code: "TOUR_THEME_SLUG_CONFLICT",
              message: "A tour theme with this slug already exists",
            },
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
    if (dto.formProfile !== undefined) {
      row.formProfile = normalizeTourFormProfileInput(dto.formProfile);
    }
    const saved = await this.settingsRepository.saveTourTheme(row);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const affected = await this.settingsRepository.deleteTourTheme(workspaceId, id);
    if (!affected) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Tour theme not found" },
      });
    }
  }

  async reorder(itemIds: string[]): Promise<WorkspaceTourThemeResponseDto[]> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const existing = await this.settingsRepository.listTourThemeIds(workspaceId);
    const existingIds = new Set(existing.map((r) => r.id));
    if (existingIds.size !== itemIds.length) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FAILED",
          message: "itemIds must include every tour theme id exactly once",
        },
      });
    }
    const seen = new Set<string>();
    for (const itemId of itemIds) {
      if (!existingIds.has(itemId) || seen.has(itemId)) {
        throw new BadRequestException({
          error: {
            code: "VALIDATION_FAILED",
            message: "itemIds must include every tour theme id exactly once",
          },
        });
      }
      seen.add(itemId);
    }

    await this.settingsRepository.reorderTourThemes(workspaceId, itemIds);

    return this.findAllByWorkspace();
  }
}
