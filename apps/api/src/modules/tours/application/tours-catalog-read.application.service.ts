import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  tenantContextMissingError,
  tenantScopedResourceNotFoundError,
} from "../../../common/errors/error-response-builders";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import {
  TOURS_CATALOG_REPOSITORY_PORT,
  type ToursCatalogRepositoryPort,
} from "../domain/ports/tours-repository.port";
import { ListToursQueryDto, toTourFilter, toTourSort } from "../dto/list-tours-query.dto";
import {
  mapTourEntityToResponseDto,
  type TourResponseSource,
  TourResponseDto,
} from "../dto/tour-response.dto";
import { TourPhotoUrlService } from "../services/tour-photo-url.service";
import { assertTourVisibleInRegionalScope } from "../utils/apply-regional-tour-list-scope";
import { buildRegionalTourListScopeFromRequest } from "../utils/regional-tour-scope-from-request";

/**
 * Application slice: **catalog read** (tenant-scoped list + get-by-id + leader aggregate).
 * Mutations stay on {@link ToursService}; persistence is behind {@link ToursCatalogRepositoryPort}.
 */
@Injectable()
export class ToursCatalogReadApplicationService {
  constructor(
    @Inject(TOURS_CATALOG_REPOSITORY_PORT)
    private readonly toursCatalogRepository: ToursCatalogRepositoryPort,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(TourPhotoUrlService)
    private readonly tourPhotoUrlService: TourPhotoUrlService,
  ) {}

  private async mapTourToResponse(tour: TourResponseSource): Promise<TourResponseDto> {
    const dto = mapTourEntityToResponseDto(tour);
    if (dto.details?.tripDetails) {
      dto.details.tripDetails =
        (await this.tourPhotoUrlService.enrichTripDetailsForResponse(
          tour.tenantId,
          tour.id,
          dto.details.tripDetails,
        )) ?? null;
    }
    return dto;
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

    const hasCursorId =
      typeof query.cursor_id === "string" && query.cursor_id.trim() !== "";
    const hasCursorAt =
      typeof query.cursor_created_at === "string" && query.cursor_created_at.trim() !== "";
    if (hasCursorId !== hasCursorAt) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: "cursor_id and cursor_created_at must both be provided for keyset pagination",
        },
      });
    }
    const useKeyset = hasCursorId && hasCursorAt;
    const cursorAt = useKeyset ? new Date(query.cursor_created_at as string) : null;
    const cursorId = useKeyset ? (query.cursor_id as string).trim() : null;
    if (useKeyset && cursorAt !== null && Number.isNaN(cursorAt.getTime())) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: "cursor_created_at must be a valid ISO-8601 date-time",
        },
      });
    }

    const result = await this.toursCatalogRepository.listTours({
      tenantId,
      filter: toTourFilter(query),
      sort: toTourSort(query),
      includeTotal: query.include_total !== false,
      regionalScope: buildRegionalTourListScopeFromRequest(this.requestContextService),
      page,
      limit,
      useKeyset,
      cursorAt,
      cursorId,
    });

    return {
      items: await Promise.all(result.items.map((row) => this.mapTourToResponse(row as TourResponseSource))),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getTourById(tourId: string): Promise<TourResponseDto> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const tour = await this.toursCatalogRepository.findByIdOrThrow(tourId, tenantId);

    const regionalScope = buildRegionalTourListScopeFromRequest(this.requestContextService);
    if (!assertTourVisibleInRegionalScope(tour, regionalScope)) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    return this.mapTourToResponse(tour as TourResponseSource);
  }

  /** Raw tenant-scoped tour row for internal services (no photo URL enrichment). */
  async getTourEntityById(tourId: string): Promise<TourResponseSource> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const tour = await this.toursCatalogRepository.findByIdOrThrow(tourId, tenantId);

    const regionalScope = buildRegionalTourListScopeFromRequest(this.requestContextService);
    if (!assertTourVisibleInRegionalScope(tour, regionalScope)) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    return tour as TourResponseSource;
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
      search: "",
    });
    return {
      tours: items,
      meta: {
        partial: total > items.length,
        total,
      },
    };
  }
}
