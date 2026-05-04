import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { CreateTourDto } from "./dto/create-tour.dto";
import { ListToursQueryDto } from "./dto/list-tours-query.dto";
import { mapTourEntityToResponseDto, TourResponseDto } from "./dto/tour-response.dto";
import { UpdateTourDto } from "./dto/update-tour.dto";
import { TourEntity, TourLifecycleStatus } from "./entities/tour.entity";

@Injectable()
export class ToursService {
  constructor(
    @InjectRepository(TourEntity)
    private readonly tourRepository: Repository<TourEntity>,
    private readonly requestContextService: RequestContextService
  ) {}

  async createTour(dto: CreateTourDto): Promise<TourResponseDto> {
    const tenantId = this.requestContextService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    try {
      const tour = this.tourRepository.create({
        tenantId,
        title: dto.title,
        description: dto.description,
        totalCapacity: dto.total_capacity,
        acceptedCount: 0,
        lifecycleStatus: dto.lifecycle_status,
        chatLink: dto.chat_link,
        costContext: dto.cost_context
      });

      const saved = await this.tourRepository.save(tour);
      return mapTourEntityToResponseDto(saved);
    } catch {
      throw new InternalServerErrorException({
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred"
        }
      });
    }
  }

  async updateTour(tourId: string, dto: UpdateTourDto): Promise<TourResponseDto> {
    const tenantId = this.requestContextService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    const hasAnyField = Object.values(dto).some((value) => value !== undefined);
    if (!hasAnyField) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: "Invalid field format"
        }
      });
    }

    const tour = await this.tourRepository.findOne({
      where: {
        id: tourId,
        tenantId
      }
    });

    if (!tour) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }

    if (
      dto.total_capacity !== undefined &&
      dto.total_capacity < tour.acceptedCount
    ) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: "Invalid field format"
        }
      });
    }

    if (
      dto.lifecycle_status !== undefined &&
      !this.isAllowedLifecycleTransition(tour.lifecycleStatus, dto.lifecycle_status)
    ) {
      throw new BadRequestException({
        error: {
          code: "STATE_TRANSITION_INVALID",
          message: "Requested lifecycle transition is not allowed"
        }
      });
    }

    try {
      if (dto.title !== undefined) {
        tour.title = dto.title;
      }
      if (dto.description !== undefined) {
        tour.description = dto.description;
      }
      if (dto.total_capacity !== undefined) {
        tour.totalCapacity = dto.total_capacity;
      }
      if (dto.lifecycle_status !== undefined) {
        tour.lifecycleStatus = dto.lifecycle_status;
      }
      if (dto.chat_link !== undefined) {
        tour.chatLink = dto.chat_link;
      }
      if (dto.cost_context !== undefined) {
        tour.costContext = dto.cost_context;
      }

      const saved = await this.tourRepository.save(tour);
      return mapTourEntityToResponseDto(saved);
    } catch {
      throw new InternalServerErrorException({
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred"
        }
      });
    }
  }

  async listTours(query: ListToursQueryDto): Promise<{
    items: TourResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const tenantId = this.requestContextService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim() ?? "";

    const qb = this.tourRepository
      .createQueryBuilder("t")
      .where("t.tenantId = :tenantId", { tenantId })
      .orderBy("t.createdAt", "DESC");

    if (search.length > 0) {
      qb.andWhere(
        "(LOWER(t.title) LIKE :search OR LOWER(COALESCE(t.description, '')) LIKE :search)",
        { search: `%${search.toLowerCase()}%` }
      );
    }

    if (query.status === "active") {
      qb.andWhere("t.lifecycleStatus = :lifecycleStatus", { lifecycleStatus: TourLifecycleStatus.DRAFT });
    } else if (query.status === "completed") {
      qb.andWhere("t.lifecycleStatus = :lifecycleStatus", { lifecycleStatus: TourLifecycleStatus.OPEN });
    } else if (query.status === "archived") {
      qb.andWhere("t.lifecycleStatus IN (:...archivedStatuses)", {
        archivedStatuses: [TourLifecycleStatus.CLOSED, TourLifecycleStatus.CANCELLED]
      });
    }

    const total = await qb.getCount();

    const rows = await qb
      .clone()
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const items = rows.map((row) => mapTourEntityToResponseDto(row));

    return { items, total, page, limit };
  }

  async getTourById(tourId: string): Promise<TourResponseDto> {
    const tenantId = this.requestContextService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    const tour = await this.tourRepository.findOne({
      where: {
        id: tourId,
        tenantId
      }
    });

    if (!tour) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found in tenant scope"
        }
      });
    }

    return mapTourEntityToResponseDto(tour);
  }

  private isAllowedLifecycleTransition(
    current: TourLifecycleStatus,
    next: TourLifecycleStatus
  ): boolean {
    if (current === next) {
      return true;
    }

    if (current === TourLifecycleStatus.DRAFT) {
      return (
        next === TourLifecycleStatus.OPEN ||
        next === TourLifecycleStatus.CANCELLED
      );
    }

    if (current === TourLifecycleStatus.OPEN) {
      return (
        next === TourLifecycleStatus.CLOSED ||
        next === TourLifecycleStatus.CANCELLED
      );
    }

    return false;
  }
}
