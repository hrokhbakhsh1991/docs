import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import { instanceToPlain } from "class-transformer";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import {
  ACCOMMODATION_TYPE_VALUES,
  MEAL_PLAN_VALUES,
  parseLegacyAccommodationTypeString,
  parseLegacyMealPlanString
} from "@repo/types";
import { WorkspaceDestinationEntity } from "../settings-locations/entities/workspace-destination.entity";
import { WorkspaceEquipmentItemEntity } from "../settings-locations/entities/workspace-equipment-item.entity";
import { WorkspaceGuideLanguageEntity } from "../settings-locations/entities/workspace-guide-language.entity";
import { WorkspaceTourThemeEntity } from "../settings-locations/entities/workspace-tour-theme.entity";
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
import type { TourTripDetails } from "./types/tour-trip-details.types";
import { TourTripDetailsDto } from "./dto/trip-details.dto";
import {
  assertTourIsPublishable,
  assertTourOpenReadiness,
  assertValidLifecycleTransition
} from "./policies/tour-lifecycle.policy";
import { mergeTourTripDetails } from "./utils/merge-trip-details";
import type { TourTransportMode } from "./tour-transport-modes";
import { computeTourDurationDays } from "./utils/tour-duration";
import { applyTourTypeFieldGates } from "./utils/tour-type-gates";
import {
  assertEquipmentIdsBelongToTenant,
  assertGuideLanguageIdsBelongToTenant,
  assertTourThemeIdsBelongToTenant,
} from "./utils/assert-workspace-catalog-ids";
import { collectWorkspaceCatalogIds } from "./utils/collect-workspace-catalog-ids";

@Injectable()
export class ToursService {
  constructor(
    @InjectRepository(TourEntity)
    private readonly tourRepository: Repository<TourEntity>,
    @InjectRepository(WorkspaceDestinationEntity)
    private readonly workspaceDestinationRepository: Repository<WorkspaceDestinationEntity>,
    @InjectRepository(WorkspaceEquipmentItemEntity)
    private readonly workspaceEquipmentRepository: Repository<WorkspaceEquipmentItemEntity>,
    @InjectRepository(WorkspaceTourThemeEntity)
    private readonly workspaceTourThemesRepository: Repository<WorkspaceTourThemeEntity>,
    @InjectRepository(WorkspaceGuideLanguageEntity)
    private readonly workspaceGuideLanguagesRepository: Repository<WorkspaceGuideLanguageEntity>,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService
  ) {}

  private async assertDestinationBelongsToTenant(
    tenantId: string,
    destinationId: string
  ): Promise<void> {
    const row = await this.workspaceDestinationRepository.findOne({
      where: { id: destinationId, tenantId },
      select: { id: true }
    });
    if (!row) {
      throw new BadRequestException({
        error: {
          code: "DESTINATION_NOT_IN_WORKSPACE",
          message: "The selected destination is not part of this workspace."
        }
      });
    }
  }

  private destinationRelation(
    destinationId: string | null | undefined
  ): WorkspaceDestinationEntity | null {
    if (!destinationId) {
      return null;
    }
    return { id: destinationId } as WorkspaceDestinationEntity;
  }

  /**
   * Ensures JSONB catalog UUID arrays (`gear*Ids`, `tourThemeIds`, `guideLanguageIds`)
   * reference existing rows scoped to the same workspace as {@link tenantId}.
   */
  private async assertTripDetailsCatalogRefsForTenant(
    tenantId: string,
    tripDetails: TourTripDetails | null | undefined,
  ): Promise<void> {
    if (tripDetails == null) {
      return;
    }
    const { equipmentIds, tourThemeIds, guideLanguageIds } = collectWorkspaceCatalogIds(tripDetails);
    await assertEquipmentIdsBelongToTenant(this.workspaceEquipmentRepository, tenantId, equipmentIds);
    await assertTourThemeIdsBelongToTenant(this.workspaceTourThemesRepository, tenantId, tourThemeIds);
    await assertGuideLanguageIdsBelongToTenant(this.workspaceGuideLanguagesRepository, tenantId, guideLanguageIds);
  }

  private static readonly tourResponseRelations = {
    details: true,
    destination: { region: true }
  } as const;

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
      | "itinerary"
      | "tripDetails"
    >
  ): boolean {
    return (
      dto.destinationName !== undefined ||
      dto.elevationM !== undefined ||
      dto.difficulty !== undefined ||
      dto.durationDays !== undefined ||
      dto.meetingPoint !== undefined ||
      dto.itinerary !== undefined ||
      dto.tripDetails !== undefined
    );
  }

  /**
   * Fills `transportationNotes` from legacy `transportation` when needed and mirrors notes
   * into `transportation` so existing readers keep working until migration is complete.
   */
  private normalizeLogisticsTransportationMigration(
    td: TourTripDetails | null | undefined,
  ): TourTripDetails | null | undefined {
    if (td == null || td.logistics == null || typeof td.logistics !== "object") {
      return td;
    }
    const lg = { ...(td.logistics as Record<string, unknown>) };
    const notes = typeof lg.transportationNotes === "string" ? lg.transportationNotes.trim() : "";
    const legacy = typeof lg.transportation === "string" ? lg.transportation.trim() : "";
    if (!notes && legacy) {
      lg.transportationNotes = legacy;
    }
    const finalNotes =
      typeof lg.transportationNotes === "string" ? lg.transportationNotes.trim() : "";
    if (finalNotes) {
      lg.transportationNotes = finalNotes;
      lg.transportation = finalNotes;
    } else {
      delete lg.transportationNotes;
      delete lg.transportation;
    }
    return { ...td, logistics: lg } as TourTripDetails;
  }

  /**
   * Promotes legacy `accommodationType` string into `accommodationTypes` / `accommodationNotes`,
   * and mirrors known types back into `accommodationType` comma-slugs for older consumers.
   */
  private normalizeLogisticsAccommodationMigration(
    td: TourTripDetails | null | undefined,
  ): TourTripDetails | null | undefined {
    if (td == null || td.logistics == null || typeof td.logistics !== "object") {
      return td;
    }
    const lg = { ...(td.logistics as Record<string, unknown>) };
    const allowed = ACCOMMODATION_TYPE_VALUES as readonly string[];

    const rawArr = lg.accommodationTypes;
    let nextTypes: string[] = [];
    if (Array.isArray(rawArr)) {
      for (const x of rawArr) {
        if (typeof x !== "string") {
          continue;
        }
        const s = x.trim().toLowerCase().replace(/\s+/g, "_");
        if (allowed.includes(s)) {
          nextTypes.push(s);
        }
      }
      nextTypes = [...new Set(nextTypes)].sort((a, b) => a.localeCompare(b));
    }

    const legacy = typeof lg.accommodationType === "string" ? lg.accommodationType.trim() : "";
    let notes = typeof lg.accommodationNotes === "string" ? lg.accommodationNotes.trim() : "";

    if (nextTypes.length === 0 && legacy) {
      const { types, remainder } = parseLegacyAccommodationTypeString(legacy);
      nextTypes = types as string[];
      if (remainder) {
        notes = notes ? `${notes}\n${remainder}` : remainder;
      }
    }

    if (nextTypes.length > 0) {
      lg.accommodationTypes = nextTypes;
    } else {
      delete lg.accommodationTypes;
    }

    if (notes) {
      lg.accommodationNotes = notes;
    } else {
      delete lg.accommodationNotes;
    }

    if (nextTypes.length > 0) {
      lg.accommodationType = nextTypes.join(", ");
    } else {
      delete lg.accommodationType;
    }

    return { ...td, logistics: lg } as TourTripDetails;
  }

  /**
   * Promotes legacy free-text `mealPlan` into enum `mealPlan` + optional `mealNotes`.
   */
  private normalizeLogisticsMealPlanMigration(
    td: TourTripDetails | null | undefined,
  ): TourTripDetails | null | undefined {
    if (td == null || td.logistics == null || typeof td.logistics !== "object") {
      return td;
    }
    const lg = { ...(td.logistics as Record<string, unknown>) };
    const allowed = MEAL_PLAN_VALUES as readonly string[];

    const raw = lg.mealPlan;
    let plan: string | undefined;
    let notes = typeof lg.mealNotes === "string" ? lg.mealNotes.trim() : "";

    if (typeof raw === "string") {
      const v = raw.trim().toLowerCase().replace(/\s+/g, "_");
      if (allowed.includes(v)) {
        plan = v;
      } else if (raw.trim()) {
        const { plan: parsedPlan, remainder } = parseLegacyMealPlanString(raw);
        if (parsedPlan) {
          plan = parsedPlan;
        }
        if (remainder) {
          notes = notes ? `${notes}\n${remainder}` : remainder;
        }
      }
    }

    if (plan) {
      lg.mealPlan = plan;
    } else {
      delete lg.mealPlan;
    }

    if (notes) {
      lg.mealNotes = notes;
    } else {
      delete lg.mealNotes;
    }

    return { ...td, logistics: lg } as TourTripDetails;
  }

  /** Drops removed free-text gear keys from JSONB so older rows are cleaned on save. */
  private stripLegacyParticipationGearKeys(
    td: TourTripDetails | null | undefined,
  ): TourTripDetails | null | undefined {
    if (td == null || typeof td !== "object") {
      return td;
    }
    const participation = td.participation;
    if (participation == null || typeof participation !== "object" || Array.isArray(participation)) {
      return td;
    }
    const p = { ...participation } as Record<string, unknown>;
    if (!("gearRequired" in p) && !("gearOptional" in p)) {
      return td;
    }
    delete p.gearRequired;
    delete p.gearOptional;
    return { ...td, participation: p as TourTripDetails["participation"] };
  }

  private tripDetailsToPersistedJson(
    value: TourTripDetailsDto | null | undefined
  ): TourTripDetails | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const parsed = JSON.parse(JSON.stringify(instanceToPlain(value))) as TourTripDetails;
    const stripped = this.stripLegacyParticipationGearKeys(parsed) ?? parsed;
    const afterTransport = this.normalizeLogisticsTransportationMigration(stripped);
    const afterAccommodation = this.normalizeLogisticsAccommodationMigration(afterTransport);
    return this.stripDeprecatedLogisticsGuideLanguage(
      this.normalizeLogisticsMealPlanMigration(afterAccommodation),
    );
  }

  /** Drops deprecated free-text `guideLanguage` from persisted logistics (use `guideLanguageIds`). */
  private stripDeprecatedLogisticsGuideLanguage(
    td: TourTripDetails | null | undefined,
  ): TourTripDetails | null | undefined {
    if (td == null || td.logistics == null || typeof td.logistics !== "object") {
      return td;
    }
    const lg = { ...(td.logistics as Record<string, unknown>) };
    delete lg.guideLanguage;
    return { ...td, logistics: lg } as TourTripDetails;
  }

  async createTour(dto: CreateTourDto): Promise<TourResponseDto> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    try {
      if (dto.destinationId) {
        await this.assertDestinationBelongsToTenant(tenantId, dto.destinationId);
      }

      let details: TourDetails | undefined;
      if (this.hasAnyTourDetailsField(dto)) {
        const d = new TourDetails();
        d.destinationName = dto.destinationName ?? null;
        d.elevationM = dto.elevationM ?? null;
        d.difficulty = dto.difficulty ?? null;
        d.durationDays = dto.durationDays ?? null;
        d.meetingPoint = dto.meetingPoint ?? null;
        d.itinerary = dto.itinerary ?? null;
        d.tripDetails =
          applyTourTypeFieldGates(
            this.tripDetailsToPersistedJson(dto.tripDetails),
            dto.tourType ?? null,
          ) ?? null;
        const derived = computeTourDurationDays(
          d.tripDetails?.logistics?.departureDate,
          d.tripDetails?.logistics?.returnDate
        );
        if (derived !== undefined) {
          d.durationDays = derived;
        }
        details = d;
      }

      if (details?.tripDetails) {
        await this.assertTripDetailsCatalogRefsForTenant(tenantId, details.tripDetails);
      }

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
        transportModes: [...new Set(dto.transportModes ?? [])].sort() as TourTransportMode[],
        destination: this.destinationRelation(dto.destinationId ?? null),
        details
      });

      const nextLifecycle = this.normalizeLifecycleStatusInput(dto.lifecycle_status);
      if (nextLifecycle === TourLifecycleStatus.OPEN) {
        assertTourOpenReadiness({
          title: tour.title,
          totalCapacity: tour.totalCapacity,
          details: tour.details ?? null
        });
      }

      const saved = await this.tourRepository.save(tour);
      const loaded = await this.tourRepository.findOne({
        where: {
          id: saved.id,
          tenantId
        },
        relations: ToursService.tourResponseRelations
      });

      if (!loaded) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }

      return mapTourEntityToResponseDto(loaded);
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
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
      relations: ToursService.tourResponseRelations
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
      if (dto.transportModes !== undefined) {
        tour.transportModes = [...new Set(dto.transportModes)].sort() as TourTransportMode[];
      }
      if (dto.destinationId !== undefined) {
        if (dto.destinationId === null) {
          tour.destination = null;
        } else {
          await this.assertDestinationBelongsToTenant(tenantId, dto.destinationId);
          tour.destination = this.destinationRelation(dto.destinationId);
        }
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
        if (dto.itinerary !== undefined) {
          tour.details.itinerary = dto.itinerary;
        }
        if (dto.tripDetails !== undefined) {
          if (dto.tripDetails === null) {
            tour.details.tripDetails = null;
          } else {
            const patch = this.tripDetailsToPersistedJson(dto.tripDetails);
            tour.details.tripDetails = this.stripLegacyParticipationGearKeys(
              mergeTourTripDetails(tour.details.tripDetails ?? null, patch as TourTripDetails),
            ) ?? null;
          }
        }

        // Strip mountain-only fields (e.g. `overview.maxAltitudeMeters`) when the
        // effective tourType is non-mountain, regardless of whether tourType was
        // changed in this patch or stayed the same.
        if (tour.details.tripDetails) {
          const gated = applyTourTypeFieldGates(tour.details.tripDetails, tour.tourType ?? null);
          tour.details.tripDetails = gated ?? null;
        }

        if (dto.tripDetails !== undefined && tour.details.tripDetails) {
          await this.assertTripDetailsCatalogRefsForTenant(tenantId, tour.details.tripDetails);
        }

        const derivedDuration = computeTourDurationDays(
          tour.details.tripDetails?.logistics?.departureDate,
          tour.details.tripDetails?.logistics?.returnDate
        );
        if (derivedDuration !== undefined) {
          tour.details.durationDays = derivedDuration;
        }
      }

      const saved = await this.tourRepository.save(tour);
      const reloaded = await this.tourRepository.findOne({
        where: { id: saved.id, tenantId },
        relations: ToursService.tourResponseRelations
      });
      if (!reloaded) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }
      return mapTourEntityToResponseDto(reloaded);
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
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
      .leftJoinAndSelect("t.destination", "destination")
      .leftJoinAndSelect("destination.region", "destinationRegion")
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
      relations: ToursService.tourResponseRelations
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
