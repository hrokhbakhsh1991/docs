import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  tenantContextMissingError,
  tenantScopedResourceNotFoundError
} from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { CreateTourDto } from "./dto/create-tour.dto";
import { ListToursQueryDto } from "./dto/list-tours-query.dto";
import { mapTourEntityToResponseDto, TourResponseDto } from "./dto/tour-response.dto";
import { UpdateTourDto } from "./dto/update-tour.dto";
import { TourEntity, TourLifecycleStatus } from "./entities/tour.entity";
import { TourDetails } from "./entities/tour-details.entity";
import { assertTourIsPublishable, assertValidLifecycleTransition } from "./policies/tour-lifecycle.policy";

@Injectable()
export class ToursService {
  constructor(
    @InjectRepository(TourEntity)
    private readonly tourRepository: Repository<TourEntity>,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService
  ) {}

  /** Align API casing (`Draft`) with Postgres enum (`DRAFT`) when class-transformer metadata is missing (e.g. tsx E2E). */
  private normalizeLifecycleStatusInput(
    value: TourLifecycleStatus | string
  ): TourLifecycleStatus {
    if (
      value === TourLifecycleStatus.DRAFT ||
      value === TourLifecycleStatus.OPEN ||
      value === TourLifecycleStatus.CLOSED ||
      value === TourLifecycleStatus.CANCELLED
    ) {
      return value;
    }
    const key = String(value).trim().toUpperCase();
    if (key === "DRAFT") return TourLifecycleStatus.DRAFT;
    if (key === "OPEN") return TourLifecycleStatus.OPEN;
    if (key === "CLOSED") return TourLifecycleStatus.CLOSED;
    if (key === "CANCELLED") return TourLifecycleStatus.CANCELLED;
    return value as TourLifecycleStatus;
  }

  private hasAnyTourDetailsField(
    dto: Pick<
      CreateTourDto | UpdateTourDto,
      | "destinationName"
      | "elevationM"
      | "difficulty"
      | "durationDays"
      | "meetingPoint"
      | "requiredGear"
      | "itinerary"
    >
  ): boolean {
    return (
      dto.destinationName !== undefined ||
      dto.elevationM !== undefined ||
      dto.difficulty !== undefined ||
      dto.durationDays !== undefined ||
      dto.meetingPoint !== undefined ||
      dto.requiredGear !== undefined ||
      dto.itinerary !== undefined
    );
  }

  async createTour(dto: CreateTourDto): Promise<TourResponseDto> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    try {
      const details = this.hasAnyTourDetailsField(dto)
        ? (() => {
            const d = new TourDetails();
            d.destinationName = dto.destinationName ?? null;
            d.elevationM = dto.elevationM ?? null;
            d.difficulty = dto.difficulty ?? null;
            d.durationDays = dto.durationDays ?? null;
            d.meetingPoint = dto.meetingPoint ?? null;
            d.requiredGear = dto.requiredGear ?? null;
            d.itinerary = dto.itinerary ?? null;
            return d;
          })()
        : undefined;

      const tour = this.tourRepository.create({
        tenantId,
        title: dto.title,
        description: dto.description,
        totalCapacity: dto.total_capacity,
        acceptedCount: 0,
        lifecycleStatus: this.normalizeLifecycleStatusInput(dto.lifecycle_status),
        chatLink: dto.chat_link,
        costContext: dto.cost_context,
        autoAcceptRegistrations: dto.autoAcceptRegistrations,
        tourType: dto.tourType,
        primaryTransportMode: dto.primaryTransportMode,
        details
      });

      const saved = await this.tourRepository.save(tour);
      const loaded = await this.tourRepository.findOne({
        where: {
          id: saved.id,
          tenantId
        },
        relations: {
          details: true
        }
      });

      if (!loaded) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }

      return mapTourEntityToResponseDto(loaded);
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
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
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
      },
      relations: {
        details: true
      }
    });

    if (!tour) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
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
      dto.lifecycle_status !== undefined
    ) {
      if (dto.lifecycle_status === TourLifecycleStatus.OPEN) {
        assertTourIsPublishable(tour);
      }
      assertValidLifecycleTransition(
        tour.lifecycleStatus,
        dto.lifecycle_status
      );
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
        tour.lifecycleStatus = this.normalizeLifecycleStatusInput(dto.lifecycle_status);
      }
      if (dto.chat_link !== undefined) {
        tour.chatLink = dto.chat_link;
      }
      if (dto.cost_context !== undefined) {
        tour.costContext = dto.cost_context;
      }
      if (dto.autoAcceptRegistrations !== undefined) {
        tour.autoAcceptRegistrations = dto.autoAcceptRegistrations;
      }
      if (dto.tourType !== undefined) {
        tour.tourType = dto.tourType;
      }
      if (dto.primaryTransportMode !== undefined) {
        tour.primaryTransportMode = dto.primaryTransportMode;
      }
      if (this.hasAnyTourDetailsField(dto)) {
        if (!tour.details) {
          tour.details = new TourDetails();
        }
        if (dto.destinationName !== undefined) {
          tour.details.destinationName = dto.destinationName;
        }
        if (dto.elevationM !== undefined) {
          tour.details.elevationM = dto.elevationM;
        }
        if (dto.difficulty !== undefined) {
          tour.details.difficulty = dto.difficulty;
        }
        if (dto.durationDays !== undefined) {
          tour.details.durationDays = dto.durationDays;
        }
        if (dto.meetingPoint !== undefined) {
          tour.details.meetingPoint = dto.meetingPoint;
        }
        if (dto.requiredGear !== undefined) {
          tour.details.requiredGear = dto.requiredGear;
        }
        if (dto.itinerary !== undefined) {
          tour.details.itinerary = dto.itinerary;
        }
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
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim() ?? "";

    const qb = this.tourRepository
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.details", "details")
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
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const tour = await this.tourRepository.findOne({
      where: {
        id: tourId,
        tenantId
      },
      relations: {
        details: true
      }
    });

    if (!tour) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    return mapTourEntityToResponseDto(tour);
  }

  async getLeaderWorkspaceAggregate(limit = 200): Promise<{
    tours: TourResponseDto[];
    meta: {
      partial: boolean;
      total: number;
    };
  }> {
    const { items, total } = await this.listTours({
      page: 1,
      limit,
      search: ""
    });
    return {
      tours: items,
      meta: {
        partial: total > items.length,
        total
      }
    };
  }

}
