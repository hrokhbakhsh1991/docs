import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import {
  tenantContextMissingError,
  tenantScopedResourceNotFoundError
} from "../../../common/errors/error-response-builders";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { ListToursQueryDto } from "../dto/list-tours-query.dto";
import { mapTourEntityToResponseDto, TourResponseDto } from "../dto/tour-response.dto";
import { TourEntity, TourLifecycleStatus } from "../entities/tour.entity";
import { TOUR_RESPONSE_RELATIONS } from "../constants/tour-response-relations";
import { applyRegionalTourListScope, assertTourVisibleInRegionalScope } from "../utils/apply-regional-tour-list-scope";
import { buildRegionalTourListScopeFromRequest } from "../utils/regional-tour-scope-from-request";

/**
 * Application slice: **catalog read** (tenant-scoped list + get-by-id + leader aggregate).
 * Mutations stay on {@link ToursService}; this service owns only read queries and DTO mapping.
 */
@Injectable()
export class ToursCatalogReadApplicationService {
  constructor(
    @InjectRepository(TourEntity)
    private readonly tourRepository: Repository<TourEntity>,
    private readonly requestContextService: RequestContextService
  ) {}

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

    const hasCursorId =
      typeof query.cursor_id === "string" && query.cursor_id.trim() !== "";
    const hasCursorAt =
      typeof query.cursor_created_at === "string" && query.cursor_created_at.trim() !== "";
    if (hasCursorId !== hasCursorAt) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: "cursor_id and cursor_created_at must both be provided for keyset pagination"
        }
      });
    }
    const useKeyset = hasCursorId && hasCursorAt;
    const cursorAt = useKeyset ? new Date(query.cursor_created_at as string) : null;
    const cursorId = useKeyset ? (query.cursor_id as string).trim() : null;
    if (useKeyset && cursorAt !== null && Number.isNaN(cursorAt.getTime())) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: "cursor_created_at must be a valid ISO-8601 date-time"
        }
      });
    }

    const qb = this.tourRepository
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.details", "details")
      .leftJoinAndSelect("t.destination", "destination")
      .leftJoinAndSelect("destination.region", "destinationRegion")
      .where("t.tenantId = :tenantId", { tenantId })
      .orderBy("t.createdAt", "DESC")
      .addOrderBy("t.id", "DESC");

    if (search.length > 0) {
      qb.andWhere("t.search_vector @@ plainto_tsquery('simple', :fts)", {
        fts: search
      });
    }

    if (query.status === "active") {
      qb.andWhere("t.lifecycleStatus = :lifecycleStatus", {
        lifecycleStatus: TourLifecycleStatus.DRAFT
      });
    } else if (query.status === "completed") {
      qb.andWhere("t.lifecycleStatus = :lifecycleStatus", {
        lifecycleStatus: TourLifecycleStatus.OPEN
      });
    } else if (query.status === "archived") {
      qb.andWhere("t.lifecycleStatus IN (:...archivedStatuses)", {
        archivedStatuses: [TourLifecycleStatus.CLOSED, TourLifecycleStatus.CANCELLED]
      });
    }

    applyRegionalTourListScope(qb, buildRegionalTourListScopeFromRequest(this.requestContextService));

    if (useKeyset && cursorAt !== null && cursorId !== null) {
      qb.andWhere(
        new Brackets((b) => {
          b.where("t.createdAt < :cAt", { cAt: cursorAt }).orWhere(
            new Brackets((inner) => {
              inner
                .where("t.createdAt = :cAt", { cAt: cursorAt })
                .andWhere("t.id < :cId", { cId: cursorId });
            })
          );
        })
      );
    }

    const includeTotal = query.include_total !== false;
    const total = includeTotal ? await qb.getCount() : -1;

    const dataQb = qb.clone();
    if (!useKeyset) {
      dataQb.skip((page - 1) * limit);
    }
    const rows = await dataQb.take(limit).getMany();

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
      relations: TOUR_RESPONSE_RELATIONS
    });

    if (!tour) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    const regionalScope = buildRegionalTourListScopeFromRequest(this.requestContextService);
    if (!assertTourVisibleInRegionalScope(tour, regionalScope)) {
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
