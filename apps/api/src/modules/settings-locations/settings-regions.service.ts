import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { CreateWorkspaceRegionDto } from "./dto/create-workspace-region.dto";
import type { UpdateWorkspaceRegionDto } from "./dto/update-workspace-region.dto";
import type { WorkspaceRegionResponseDto } from "./dto/workspace-region-response.dto";
import { WorkspaceRegionEntity } from "./entities/workspace-region.entity";

@Injectable()
export class SettingsRegionsService {
  constructor(
    @InjectRepository(WorkspaceRegionEntity)
    private readonly regionRepository: Repository<WorkspaceRegionEntity>,
    private readonly requestContext: RequestContextService
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

  private toResponse(row: WorkspaceRegionEntity): WorkspaceRegionResponseDto {
    return {
      id: row.id,
      name: row.name,
      country: row.country ?? null,
      sortOrder: row.sortOrder ?? null,
      isActive: row.isActive
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
    const rows = await this.regionRepository.find({
      where: { tenantId },
      order: { sortOrder: "ASC", name: "ASC" }
    });
    return rows.map((r) => this.toResponse(r));
  }

  async create(dto: CreateWorkspaceRegionDto): Promise<WorkspaceRegionResponseDto> {
    const tenantId = this.resolveTenantOrThrow();
    const row = this.regionRepository.create({
      tenantId,
      name: dto.name.trim(),
      country: this.normalizeCountry(dto.country),
      sortOrder: dto.sortOrder ?? null,
      isActive: dto.isActive
    });
    const saved = await this.regionRepository.save(row);
    return this.toResponse(saved);
  }

  async update(regionId: string, dto: UpdateWorkspaceRegionDto): Promise<WorkspaceRegionResponseDto> {
    const tenantId = this.resolveTenantOrThrow();
    const row = await this.regionRepository.findOne({ where: { id: regionId, tenantId } });
    if (!row) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Region not found" }
      });
    }
    const keys = Object.keys(dto) as (keyof UpdateWorkspaceRegionDto)[];
    if (keys.length === 0) {
      throw new BadRequestException({
        error: { code: "VALIDATION_FAILED", message: "No fields to update" }
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
    const saved = await this.regionRepository.save(row);
    return this.toResponse(saved);
  }

  async remove(regionId: string): Promise<void> {
    const tenantId = this.resolveTenantOrThrow();
    const res = await this.regionRepository.delete({ id: regionId, tenantId });
    if (!res.affected) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: "Region not found" }
      });
    }
  }
}
