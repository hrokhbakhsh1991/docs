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
import type { CreateWorkspaceDestinationDto } from "./dto/create-workspace-destination.dto";
import type { UpdateWorkspaceDestinationDto } from "./dto/update-workspace-destination.dto";
import type { WorkspaceDestinationResponseDto } from "./dto/workspace-destination-response.dto";
import type { WorkspaceDestinationRecord } from "./domain/workspace-catalog.records";

@Injectable()
export class SettingsDestinationsService {
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

  private toResponse(row: WorkspaceDestinationRecord): WorkspaceDestinationResponseDto {
    return {
      id: row.id,
      name: row.name,
      regionId: row.regionId,
      type: row.type ?? null,
      altitudeM: row.altitudeM ?? null,
      sortOrder: row.sortOrder ?? null,
      isActive: row.isActive,
    };
  }

  private async assertRegionInTenant(regionId: string, tenantId: string): Promise<void> {
    const ok = await this.settingsRepository.regionExists(tenantId, regionId);
    if (!ok) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "Region does not exist in this workspace" },
      });
    }
  }

  async list(): Promise<WorkspaceDestinationResponseDto[]> {
    const tenantId = this.resolveTenantOrThrow();
    const rows = await this.settingsRepository.listDestinations(tenantId);
    return rows.map((r) => this.toResponse(r));
  }

  async create(dto: CreateWorkspaceDestinationDto): Promise<WorkspaceDestinationResponseDto> {
    const tenantId = this.resolveTenantOrThrow();
    await this.assertRegionInTenant(dto.regionId, tenantId);
    const row = this.settingsRepository.newDestination({
      tenantId,
      regionId: dto.regionId,
      name: dto.name.trim(),
      type: dto.type != null && String(dto.type).trim() !== "" ? String(dto.type).trim() : null,
      altitudeM: dto.altitudeM ?? null,
      sortOrder: dto.sortOrder ?? null,
      isActive: dto.isActive,
    });
    const saved = await this.settingsRepository.saveDestination(row);
    return this.toResponse(saved);
  }

  async update(
    destinationId: string,
    dto: UpdateWorkspaceDestinationDto,
  ): Promise<WorkspaceDestinationResponseDto> {
    const tenantId = this.resolveTenantOrThrow();
    const row = await this.settingsRepository.findDestinationById(tenantId, destinationId);
    if (!row) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Destination not found" },
      });
    }
    const keys = Object.keys(dto) as (keyof UpdateWorkspaceDestinationDto)[];
    if (keys.length === 0) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "No fields to update" },
      });
    }
    if (dto.regionId !== undefined) {
      await this.assertRegionInTenant(dto.regionId, tenantId);
      row.regionId = dto.regionId;
    }
    if (dto.name !== undefined) {
      row.name = dto.name.trim();
    }
    if (dto.type !== undefined) {
      row.type = dto.type != null && String(dto.type).trim() !== "" ? String(dto.type).trim() : null;
    }
    if (dto.altitudeM !== undefined) {
      row.altitudeM = dto.altitudeM;
    }
    if (dto.sortOrder !== undefined) {
      row.sortOrder = dto.sortOrder;
    }
    if (dto.isActive !== undefined) {
      row.isActive = dto.isActive;
    }
    const saved = await this.settingsRepository.saveDestination(row);
    return this.toResponse(saved);
  }

  async remove(destinationId: string): Promise<void> {
    const tenantId = this.resolveTenantOrThrow();
    const affected = await this.settingsRepository.deleteDestination(tenantId, destinationId);
    if (!affected) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Destination not found" },
      });
    }
  }
}
