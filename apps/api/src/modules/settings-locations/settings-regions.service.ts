import {
  BadRequestException,
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
import type { CreateWorkspaceRegionDto } from "./dto/create-workspace-region.dto";
import type { UpdateWorkspaceRegionDto } from "./dto/update-workspace-region.dto";
import type { WorkspaceRegionResponseDto } from "./dto/workspace-region-response.dto";
import type { WorkspaceRegionRecord } from "./domain/workspace-catalog.records";

@Injectable()
export class SettingsRegionsService {
  constructor(
    @Inject(WORKSPACE_SETTINGS_REPOSITORY_PORT)
    private readonly settingsRepository: WorkspaceSettingsRepositoryPort,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  private resolveTenantOrThrow(): string {
    const tenantId = this.requestContext.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    const userId = this.requestContext.getUserId();
    if (!userId) {
      throw new ForbiddenException(authRequiredError());
    }
    return tenantId;
  }

  private toResponse(row: WorkspaceRegionRecord): WorkspaceRegionResponseDto {
    return {
      id: row.id,
      name: row.name,
      country: row.country ?? null,
      sortOrder: row.sortOrder ?? null,
      isActive: row.isActive,
    };
  }

  private normalizeCountry(value: string | null | undefined): string | null {
    if (value == null) {
      return null;
    }
    const t = String(value).trim();
    return t === "" ? null : t;
  }

  async list(): Promise<WorkspaceRegionResponseDto[]> {
    const tenantId = this.resolveTenantOrThrow();
    const rows = await this.settingsRepository.listRegions(tenantId);
    return rows.map((r) => this.toResponse(r));
  }

  async create(dto: CreateWorkspaceRegionDto): Promise<WorkspaceRegionResponseDto> {
    const tenantId = this.resolveTenantOrThrow();
    const row = this.settingsRepository.newRegion({
      tenantId,
      name: dto.name.trim(),
      country: this.normalizeCountry(dto.country),
      sortOrder: dto.sortOrder ?? null,
      isActive: dto.isActive,
    });
    const saved = await this.settingsRepository.saveRegion(row);
    return this.toResponse(saved);
  }

  async update(regionId: string, dto: UpdateWorkspaceRegionDto): Promise<WorkspaceRegionResponseDto> {
    const tenantId = this.resolveTenantOrThrow();
    const row = await this.settingsRepository.findRegionById(tenantId, regionId);
    if (!row) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Region not found" },
      });
    }
    const keys = Object.keys(dto) as (keyof UpdateWorkspaceRegionDto)[];
    if (keys.length === 0) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "No fields to update" },
      });
    }
    if (dto.name !== undefined) {
      row.name = dto.name.trim();
    }
    if (dto.country !== undefined) {
      row.country = this.normalizeCountry(dto.country);
    }
    if (dto.sortOrder !== undefined) {
      row.sortOrder = dto.sortOrder;
    }
    if (dto.isActive !== undefined) {
      row.isActive = dto.isActive;
    }
    const saved = await this.settingsRepository.saveRegion(row);
    return this.toResponse(saved);
  }

  async remove(regionId: string): Promise<void> {
    const tenantId = this.resolveTenantOrThrow();
    const affected = await this.settingsRepository.deleteRegion(tenantId, regionId);
    if (!affected) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Region not found" },
      });
    }
  }
}
