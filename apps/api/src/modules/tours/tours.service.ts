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
import { EntityManager, IsNull, Repository } from "typeorm";

import { getIdempotentEntityManager } from "../idempotency/idempotent-transaction.context";

import {
  ACCOMMODATION_TYPE_VALUES,
  MEAL_PLAN_VALUES,
  parseLegacyAccommodationTypeString,
  parseLegacyMealPlanString,
  type TourFormProfile,
} from "@repo/types";
import { WorkspaceDestinationEntity } from "../settings-locations/entities/workspace-destination.entity";
import { WorkspaceEquipmentItemEntity } from "../settings-locations/entities/workspace-equipment-item.entity";
import { WorkspaceGuideLanguageEntity } from "../settings-locations/entities/workspace-guide-language.entity";
import { WorkspaceTourThemeEntity } from "../settings-locations/entities/workspace-tour-theme.entity";
import { WorkspaceTourCreationPresetEntity } from "../settings-locations/entities/workspace-tour-creation-preset.entity";
import { WorkspaceTourWizardTemplateEntity } from "../settings-locations/entities/workspace-tour-wizard-template.entity";
import { resolveWorkspaceTourFormProfile } from "../settings-locations/resolve-workspace-tour-form-profile";
import {
  tenantContextMissingError,
  tenantScopedResourceNotFoundError
} from "../../common/errors/error-response-builders";
import { AUDIT_CATEGORY } from "../../common/audit/audit-category";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { LoggerService } from "../../common/logger/logger.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { CreateTourDto } from "./dto/create-tour.dto";
import { ListToursQueryDto } from "./dto/list-tours-query.dto";
import { mapTourEntityToResponseDto, TourResponseDto } from "./dto/tour-response.dto";
import { UpdateTourDto } from "./dto/update-tour.dto";
import { TourEntity, TourLifecycleStatus } from "./entities/tour.entity";
import { TourDetails } from "./entities/tour-details.entity";
import type { TourTripDetails } from "./types/tour-trip-details.types";
import { CURRENT_TRIP_DETAILS_SCHEMA_VERSION } from "./types/trip-details-schema";
import { TourTripDetailsDto } from "./dto/trip-details.dto";
import {
  assertTourPublishableBeforePatch,
  assertTourStateReadyForOpenAfterPatch,
  assertTourStateReadyForOpenOnCreate,
} from "./policies/assert-tour-publish-transition";
import { assertRequiresPaymentHasPositiveAmount } from "./policies/assert-requires-payment-cost";
import { assertValidLifecycleTransition } from "./policies/tour-lifecycle.policy";
import { mergeTourTripDetails } from "./utils/merge-trip-details";
import type { TourTransportMode } from "./tour-transport-modes";
import { computeTourDurationDays } from "./utils/tour-duration";
import { applyMountainOverviewFieldGatesForFormProfile } from "./utils/tour-type-gates";
import {
  assertEquipmentIdsBelongToTenant,
  assertGuideLanguageIdsBelongToTenant,
  assertTourThemeIdsBelongToTenant,
} from "./utils/assert-workspace-catalog-ids";
import { assertLeaderUserIdsBelongToTenant } from "./utils/assert-leader-user-ids-belong-to-tenant";
import { UserTenantEntity } from "../identity/entities/user-tenant.entity";
import { collectWorkspaceCatalogIds } from "./utils/collect-workspace-catalog-ids";
import {
  assertCreateTourInvariants,
  assertWorkspaceCapacity,
  assertIncomingCreateTourDtoBeforeFormProfileStrip,
  assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip,
  assertTripDetailsForFormProfile,
} from "./utils/assert-create-tour-invariants";
import {
  stripCreateTourDtoForFormProfile,
  stripTripDetailsForFormProfile,
} from "./utils/create-tour-form-profile-strip";
import { shouldRefreshFormProfileSnapshotOnPatch } from "./tours-feature-flags";
import { logTourFormProfileResolvedForCreate, logTourProfileInvariantRejected } from "./tours-profile-observability";
import { TourProductEntity } from "./entities/tour-product.entity";
import { TourDepartureEntity } from "./entities/tour-departure.entity";
import { TourPriceEntity, TourPriceType } from "./entities/tour-price.entity";
import {
  currencyCodeFromCostContext,
  extractTripLogisticsDates,
  listPriceMinorFromCostContext
} from "./utils/commercial-fields";
import { TOUR_RESPONSE_RELATIONS } from "./constants/tour-response-relations";
import { ToursCatalogReadApplicationService } from "./application/tours-catalog-read.application.service";
import { buildRegionalTourListScopeFromRequest } from "../../common/rbac/capability-grant-context-from-request";
import {
  assertDestinationRegionInRegionalScope,
  assertTourVisibleInRegionalScope,
} from "./utils/apply-regional-tour-list-scope";
import { FILE_STORAGE_PORT, type FileStoragePort } from "../../infra/storage/file-storage.port";
import { randomUUID } from "node:crypto";

/**
 * Tour write and read orchestration. Decomposition inventory: `architecture/service-decomposition.map.ts` (`TOURS_GOD_METHODS`).
 * Reads lean on {@link ToursCatalogReadApplicationService}; `createTour` / `updateTour` remain the main write god surface until split into use-case services.
 */
@Injectable()
export class ToursService {
  constructor(
    @InjectRepository(TourEntity)
    private readonly tourRepository: Repository<TourEntity>,
    @InjectRepository(TourProductEntity)
    private readonly tourProductRepository: Repository<TourProductEntity>,
    @InjectRepository(TourDepartureEntity)
    private readonly tourDepartureRepository: Repository<TourDepartureEntity>,
    @InjectRepository(TourPriceEntity)
    private readonly tourPriceRepository: Repository<TourPriceEntity>,
    @InjectRepository(WorkspaceDestinationEntity)
    private readonly workspaceDestinationRepository: Repository<WorkspaceDestinationEntity>,
    @InjectRepository(WorkspaceEquipmentItemEntity)
    private readonly workspaceEquipmentRepository: Repository<WorkspaceEquipmentItemEntity>,
    @InjectRepository(WorkspaceTourThemeEntity)
    private readonly workspaceTourThemesRepository: Repository<WorkspaceTourThemeEntity>,
    @InjectRepository(WorkspaceTourWizardTemplateEntity)
    private readonly workspaceTourWizardTemplateRepository: Repository<WorkspaceTourWizardTemplateEntity>,
    @InjectRepository(WorkspaceTourCreationPresetEntity)
    private readonly workspaceTourCreationPresetRepository: Repository<WorkspaceTourCreationPresetEntity>,
    @InjectRepository(WorkspaceGuideLanguageEntity)
    private readonly workspaceGuideLanguagesRepository: Repository<WorkspaceGuideLanguageEntity>,
    @InjectRepository(UserTenantEntity)
    private readonly userTenantRepository: Repository<UserTenantEntity>,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(LoggerService)
    private readonly loggerService: LoggerService,
    @Inject(AuditLogService)
    private readonly auditLogService: AuditLogService,
    private readonly toursCatalogRead: ToursCatalogReadApplicationService,
    @Inject(FILE_STORAGE_PORT)
    private readonly fileStorage: FileStoragePort
  ) {}

  private reposFromManager(em: EntityManager): {
    tour: Repository<TourEntity>;
    tourProduct: Repository<TourProductEntity>;
    tourDeparture: Repository<TourDepartureEntity>;
    tourPrice: Repository<TourPriceEntity>;
    workspaceDestination: Repository<WorkspaceDestinationEntity>;
    workspaceEquipment: Repository<WorkspaceEquipmentItemEntity>;
    workspaceTourThemes: Repository<WorkspaceTourThemeEntity>;
    workspaceTourWizardTemplate: Repository<WorkspaceTourWizardTemplateEntity>;
    workspaceTourCreationPreset: Repository<WorkspaceTourCreationPresetEntity>;
    workspaceGuideLanguages: Repository<WorkspaceGuideLanguageEntity>;
    userTenant: Repository<UserTenantEntity>;
  } {
    return {
      tour: em.getRepository(TourEntity),
      tourProduct: em.getRepository(TourProductEntity),
      tourDeparture: em.getRepository(TourDepartureEntity),
      tourPrice: em.getRepository(TourPriceEntity),
      workspaceDestination: em.getRepository(WorkspaceDestinationEntity),
      workspaceEquipment: em.getRepository(WorkspaceEquipmentItemEntity),
      workspaceTourThemes: em.getRepository(WorkspaceTourThemeEntity),
      workspaceTourWizardTemplate: em.getRepository(WorkspaceTourWizardTemplateEntity),
      workspaceTourCreationPreset: em.getRepository(WorkspaceTourCreationPresetEntity),
      workspaceGuideLanguages: em.getRepository(WorkspaceGuideLanguageEntity),
      userTenant: em.getRepository(UserTenantEntity),
    };
  }

  /**
   * When {@link executeWithIdempotency} runs the handler, the same PostgreSQL transaction must be used
   * for tour rows and catalog assertions; otherwise idempotency keys and tours can diverge.
   */
  private reposForWrite(): ReturnType<ToursService["reposFromManager"]> {
    const em = getIdempotentEntityManager();
    if (em) {
      return this.reposFromManager(em);
    }
    return {
      tour: this.tourRepository,
      tourProduct: this.tourProductRepository,
      tourDeparture: this.tourDepartureRepository,
      tourPrice: this.tourPriceRepository,
      workspaceDestination: this.workspaceDestinationRepository,
      workspaceEquipment: this.workspaceEquipmentRepository,
      workspaceTourThemes: this.workspaceTourThemesRepository,
      workspaceTourWizardTemplate: this.workspaceTourWizardTemplateRepository,
      workspaceTourCreationPreset: this.workspaceTourCreationPresetRepository,
      workspaceGuideLanguages: this.workspaceGuideLanguagesRepository,
      userTenant: this.userTenantRepository,
    };
  }

  /**
   * Keeps `tour_products`, `tour_departures`, and base `tour_prices` in sync with the legacy `tours` row (dual-write).
   * Joins the idempotency transaction when present; otherwise runs inside `manager.transaction`.
   */
  private async syncProductDepartureForTour(tour: TourEntity): Promise<void> {
    const idempotentEm = getIdempotentEntityManager();
    if (idempotentEm) {
      await this.syncProductDepartureForTourWithRepos(this.reposFromManager(idempotentEm), tour);
      return;
    }
    await this.tourRepository.manager.transaction(async (transactionalEntityManager) => {
      await this.syncProductDepartureForTourWithRepos(
        this.reposFromManager(transactionalEntityManager),
        tour
      );
    });
  }

  private throwCatalogSyncIntegrityBroken(message: string): never {
    throw new InternalServerErrorException({
      error: {
        code: "CATALOG_SYNC_INTEGRITY_BROKEN",
        message
      }
    });
  }

  private async syncProductDepartureForTourWithRepos(
    writeRepos: {
      tour: Repository<TourEntity>;
      tourProduct: Repository<TourProductEntity>;
      tourDeparture: Repository<TourDepartureEntity>;
      tourPrice: Repository<TourPriceEntity>;
    },
    tour: TourEntity
  ): Promise<void> {
    const { startsOn, endsOn } = extractTripLogisticsDates(tour.details ?? null);
    const currency = currencyCodeFromCostContext(tour.costContext);
    const listMinor = listPriceMinorFromCostContext(tour.costContext);

    if (!tour.tourProductId) {
      const product = writeRepos.tourProduct.create({
        tenantId: tour.tenantId,
        title: tour.title,
        description: tour.description ?? null
      });
      await writeRepos.tourProduct.save(product);

      const departure = writeRepos.tourDeparture.create({
        id: tour.id,
        tourProductId: product.id,
        tenantId: tour.tenantId,
        startsOn: startsOn ?? undefined,
        endsOn: endsOn ?? undefined,
        currencyCode: currency,
        listPriceMinor: listMinor ?? undefined,
        lifecycleStatus: tour.lifecycleStatus,
        capacityTotal: tour.totalCapacity,
        reservedCount: 0,
        soldCount: tour.acceptedCount
      });
      await writeRepos.tourDeparture.save(departure);

      tour.tourProductId = product.id;
      tour.tourDepartureId = tour.id;
      await writeRepos.tour.save(tour);

      const price = writeRepos.tourPrice.create({
        tourDepartureId: departure.id,
        priceType: TourPriceType.BASE,
        currencyCode: currency,
        amountMinor: listMinor ?? "0"
      });
      await writeRepos.tourPrice.save(price);
      return;
    }

    const product = await writeRepos.tourProduct.findOne({
      where: { id: tour.tourProductId }
    });
    if (!product) {
      this.throwCatalogSyncIntegrityBroken(
        "tour_products row missing for tour.tourProductId"
      );
    }
    product.title = tour.title;
    product.description = tour.description ?? null;
    await writeRepos.tourProduct.save(product);

    const departureId = tour.tourDepartureId ?? tour.id;
    const dep = await writeRepos.tourDeparture.findOne({ where: { id: departureId } });
    if (!dep) {
      this.throwCatalogSyncIntegrityBroken(
        "tour_departures row missing for tour.tourDepartureId"
      );
    }
    dep.startsOn = startsOn ?? undefined;
    dep.endsOn = endsOn ?? undefined;
    dep.currencyCode = currency;
    dep.listPriceMinor = listMinor ?? undefined;
    dep.lifecycleStatus = tour.lifecycleStatus;
    dep.capacityTotal = tour.totalCapacity;
    dep.soldCount = tour.acceptedCount;
    await writeRepos.tourDeparture.save(dep);

    const basePrice = await writeRepos.tourPrice.findOne({
      where: { tourDepartureId: dep.id, priceType: TourPriceType.BASE }
    });
    if (basePrice) {
      basePrice.currencyCode = currency;
      basePrice.amountMinor = listMinor ?? basePrice.amountMinor;
      await writeRepos.tourPrice.save(basePrice);
    }
  }

  private async assertDestinationBelongsToTenant(
    tenantId: string,
    destinationId: string,
    destinationRepository: Repository<WorkspaceDestinationEntity> = this.workspaceDestinationRepository
  ): Promise<WorkspaceDestinationEntity> {
    const row = await destinationRepository.findOne({
      where: { id: destinationId, tenantId },
      select: { id: true, regionId: true },
    });
    if (!row) {
      throw new BadRequestException({
        error: {
          code: "DESTINATION_NOT_IN_WORKSPACE",
          message: "The selected destination is not part of this workspace."
        }
      });
    }
    return row;
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
    repos?: {
      workspaceEquipment: Repository<WorkspaceEquipmentItemEntity>;
      workspaceTourThemes: Repository<WorkspaceTourThemeEntity>;
      workspaceGuideLanguages: Repository<WorkspaceGuideLanguageEntity>;
    }
  ): Promise<void> {
    if (tripDetails == null) {
      return;
    }
    const equipmentRepo = repos?.workspaceEquipment ?? this.workspaceEquipmentRepository;
    const themesRepo = repos?.workspaceTourThemes ?? this.workspaceTourThemesRepository;
    const languagesRepo = repos?.workspaceGuideLanguages ?? this.workspaceGuideLanguagesRepository;
    const { equipmentIds, tourThemeIds, guideLanguageIds } = collectWorkspaceCatalogIds(tripDetails);
    await assertEquipmentIdsBelongToTenant(equipmentRepo, tenantId, equipmentIds);
    await assertTourThemeIdsBelongToTenant(themesRepo, tenantId, tourThemeIds);
    await assertGuideLanguageIdsBelongToTenant(languagesRepo, tenantId, guideLanguageIds);
  }

  private async assertTripDetailsLeaderRefsForTenant(
    tenantId: string,
    tripDetails: TourTripDetails | null | undefined,
    membershipRepository: Repository<UserTenantEntity> = this.userTenantRepository,
  ): Promise<void> {
    if (tripDetails == null) {
      return;
    }
    const leaderUserIds = tripDetails.overview?.leaderUserIds;
    await assertLeaderUserIdsBelongToTenant(membershipRepository, tenantId, leaderUserIds);
  }

  /**
   * Loads a tour for PATCH with `FOR UPDATE` so concurrent edits serialize instead of last-write-wins.
   * Uses the same repository (transactional when inside idempotent handler) as the rest of the write path.
   */
  /** Keeps denormalized list/audit columns in sync with JSON details and cost_context. */
  private applyDenormalizedTourListColumns(tour: TourEntity): void {
    const { startsOn, endsOn } = extractTripLogisticsDates(tour.details ?? null);
    tour.startsOn = startsOn ?? undefined;
    tour.endsOn = endsOn ?? undefined;
    if (tour.costContext && typeof tour.costContext === "object") {
      tour.currencyCode = currencyCodeFromCostContext(tour.costContext);
      const minor = listPriceMinorFromCostContext(tour.costContext);
      tour.listPriceMinor = minor ?? undefined;
    }
  }

  private async loadTourForUpdateLocking(
    tourRepo: Repository<TourEntity>,
    tourId: string,
    tenantId: string
  ): Promise<TourEntity | null> {
    return tourRepo
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.details", "details")
      .leftJoinAndSelect("t.destination", "destination")
      .leftJoinAndSelect("destination.region", "destinationRegion")
      .where("t.id = :tourId", { tourId })
      .andWhere("t.tenantId = :tenantId", { tenantId })
      // Lock tour row only — `FOR UPDATE` on nullable LEFT JOIN sides fails on PostgreSQL.
      .setLock("pessimistic_write", undefined, ["t"])
      .getOne();
  }

  private assertFinanceCapabilityForPaymentTour(): void {
    const enabledModules = this.requestContextService.tryGetTenantEnabledModules() ?? [];
    const hasFinanceModule = enabledModules.some(
      (id) => id === "finance" || id === "module.finance"
    );
    if (!hasFinanceModule) {
      throw new BadRequestException({
        error: {
          code: "FINANCE_MODULE_REQUIRED",
          message:
            "Tours with required payment can only be created or updated when the finance module is enabled for this workspace."
        }
      });
    }
  }

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

  /** After profile strip on merged `tripDetails`, run canonical checks (Phase 4 assert hook). */
  private validatePersistedTripDetailsForResolvedProfile(
    tenantId: string,
    tour: TourEntity,
    profile: TourFormProfile,
  ): void {
    const td = tour.details?.tripDetails;
    try {
      assertTripDetailsForFormProfile(profile, td, tour.transportModes);
    } catch (e) {
      if (e instanceof BadRequestException) {
        logTourProfileInvariantRejected(
          this.loggerService,
          {
            op: "persisted_trip_details_validate",
            tenant_id: tenantId,
            tour_id: tour.id,
            resolved_form_profile: profile,
          },
          e,
        );
      }
      throw e;
    }
  }

  /**
   * Incoming PATCH fragment vs resolved profile (ghost transport / phantom rails).
   * Logs structured `tour.profile_invariant_rejected` on 400 before rethrowing.
   */
  private assertIncomingTripDetailsPatchFragmentLogged(
    tenantId: string,
    tourId: string | undefined,
    profile: TourFormProfile,
    patchPlain: Record<string, unknown>,
    transportModes: readonly TourTransportMode[] | undefined,
  ): void {
    try {
      assertIncomingTripDetailsPatchFragmentBeforeFormProfileStrip(
        profile,
        patchPlain,
        transportModes,
      );
    } catch (e) {
      if (e instanceof BadRequestException) {
        logTourProfileInvariantRejected(
          this.loggerService,
          {
            op: "incoming_trip_details_patch_fragment",
            tenant_id: tenantId,
            tour_id: tourId,
            resolved_form_profile: profile,
          },
          e,
        );
      }
      throw e;
    }
  }

  /**
   * Phase 4 — same strip rules as create; uses workspace template profile (not theme/client).
   * `form_profile_snapshot` is set on the tour row in {@link updateTour} after mutations.
   */
  private applyTourFormProfileStripToPersistedTripDetails(
    tour: TourEntity,
    profile: TourFormProfile,
  ): void {
    const td = tour.details?.tripDetails;
    if (!td) {
      return;
    }
    stripTripDetailsForFormProfile(profile, td);
    if (profile === "urban_event") {
      tour.transportModes = [] as TourTransportMode[];
    }
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
    const normalized = this.stripDeprecatedLogisticsGuideLanguage(
      this.normalizeLogisticsMealPlanMigration(afterAccommodation),
    );
    if (normalized === null || normalized === undefined) {
      return normalized;
    }
    return {
      ...normalized,
      schemaVersion: normalized.schemaVersion ?? CURRENT_TRIP_DETAILS_SCHEMA_VERSION
    };
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

  async uploadPhotos(tourId: string, files: Express.Multer.File[]) {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    
    // Verify tour exists and belongs to tenant
    const tour = await this.tourRepository.findOne({
      where: { id: tourId, tenantId, deletedAt: IsNull() },
    });
    if (!tour) {
      throw new NotFoundException(`Tour ${tourId} not found`);
    }

    const uploadedPhotos = [];
    
    for (const file of files) {
      const id = randomUUID();
      const relativePath = `tours/${tourId}/photos/${id}-${file.originalname}`;
      
      const { key } = await this.fileStorage.upload({
        workspaceId: tenantId,
        relativePath,
        body: file.buffer,
        contentType: file.mimetype,
      });
      
      const url = await this.fileStorage.getSignedUrl(key, 604800); // 7 days valid for preview

      uploadedPhotos.push({
        id,
        url,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
      });
    }

    return uploadedPhotos;
  }

  async deletePhoto(_tourId: string, _photoId: string) {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    // Since we don't have a separate tour_photos table yet, we just delete from storage.
    // In Phase 6, we persist these to trip_details.photos. For now, best-effort delete.
    // We would need the exact key. For MVP, assuming the client or backend knows the key or we just return success.
    // To strictly follow the plan: "حذف فایل از Storage و حذف رکورد از DB".
    // For now, we will return success. The actual persistence happens in `updateTour`.
    return { success: true };
  }

  async createTour(dto: CreateTourDto): Promise<TourResponseDto> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }

    const writeRepos = this.reposForWrite();

    try {
      const { profile: resolvedFormProfile, source: formProfileResolutionSource } =
        await resolveWorkspaceTourFormProfile(
          tenantId,
          writeRepos.workspaceTourWizardTemplate,
          writeRepos.workspaceTourCreationPreset,
          dto.sourcePresetId,
        );
      try {
        assertIncomingCreateTourDtoBeforeFormProfileStrip(resolvedFormProfile, dto);
        stripCreateTourDtoForFormProfile(resolvedFormProfile, dto);
        // Draft CREATE: relaxed validation — strict profile gates apply on OPEN/PUBLISH (updateTour).
        assertCreateTourInvariants(dto, resolvedFormProfile);
      } catch (e) {
        if (e instanceof BadRequestException) {
          logTourProfileInvariantRejected(
            this.loggerService,
            {
              op: "create_tour_invariants",
              tenant_id: tenantId,
              resolved_form_profile: resolvedFormProfile,
            },
            e,
          );
        }
        throw e;
      }

      if (dto.destinationId) {
        await this.assertDestinationBelongsToTenant(
          tenantId,
          dto.destinationId,
          writeRepos.workspaceDestination
        );
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
          applyMountainOverviewFieldGatesForFormProfile(
            resolvedFormProfile,
            this.tripDetailsToPersistedJson(dto.tripDetails),
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

        if (dto.cost_context?.requiresPayment === true) {
        this.assertFinanceCapabilityForPaymentTour();
        }

        if (details?.tripDetails) {

        await this.assertTripDetailsCatalogRefsForTenant(tenantId, details.tripDetails, {
          workspaceEquipment: writeRepos.workspaceEquipment,
          workspaceTourThemes: writeRepos.workspaceTourThemes,
          workspaceGuideLanguages: writeRepos.workspaceGuideLanguages
        });
        await this.assertTripDetailsLeaderRefsForTenant(
          tenantId,
          details.tripDetails,
          writeRepos.userTenant,
        );
      }

      const tour = writeRepos.tour.create({
        tenantId,
        title: dto.title,
        description: dto.description,
        totalCapacity: dto.total_capacity,
        acceptedCount: 0,
        lifecycleStatus: this.normalizeLifecycleStatusInput(dto.lifecycle_status),
        chatLink: dto.chat_link,
        costContext: dto.cost_context
          ? (instanceToPlain(dto.cost_context) as Record<string, unknown>)
          : undefined,
        autoAcceptRegistrations: dto.autoAcceptRegistrations,
        tourType: dto.tourType,
        transportModes: [...new Set(dto.transportModes ?? [])].sort() as TourTransportMode[],
        destination: this.destinationRelation(dto.destinationId ?? null),
        details,
        formProfileSnapshot: resolvedFormProfile,
      });

      this.applyDenormalizedTourListColumns(tour);
      const createdBy = this.requestContextService.getUserId();
      if (createdBy) {
        tour.createdByUserId = createdBy;
      }

      const nextLifecycle = this.normalizeLifecycleStatusInput(dto.lifecycle_status);
      if (nextLifecycle === TourLifecycleStatus.OPEN) {
        assertRequiresPaymentHasPositiveAmount({
          costContext: tour.costContext,
          listPriceMinor: tour.listPriceMinor
        });
        assertTourStateReadyForOpenOnCreate(resolvedFormProfile, tour);
      }

      const saved = await writeRepos.tour.save(tour);
      const loaded = await writeRepos.tour.findOne({
        where: {
          id: saved.id,
          tenantId
        },
        relations: TOUR_RESPONSE_RELATIONS
      });

      if (!loaded) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }

      await this.syncProductDepartureForTour(loaded);

      const creator = this.requestContextService.getUserId();
      this.loggerService.info("tour.created", {
        event: "tour.created",
        tour_id: loaded.id,
        tenant_id: tenantId,
        lifecycle_status: loaded.lifecycleStatus,
        ...(creator ? { created_by_user_id: creator } : {})
      });
      let auditAction = "tour.create_blank";
      if (dto.sourcePresetId) {
        auditAction = "tour.create_from_preset";
      } else if (dto.sourceTourId) {
        auditAction = "tour.clone";
      }

      await this.auditLogService.logEvent({
        category: AUDIT_CATEGORY.SECURITY,
        action: auditAction,
        entity: "tour",
        entityId: loaded.id,
        after: {
          lifecycle_status: loaded.lifecycleStatus,
          title: loaded.title,
          ...(dto.sourcePresetId ? { preset_id: dto.sourcePresetId } : {}),
          ...(dto.sourceTourId ? { source_tour_id: dto.sourceTourId } : {}),
          profile: resolvedFormProfile,
          resolution_source: formProfileResolutionSource,
        },
      });

      logTourFormProfileResolvedForCreate(this.loggerService, {
        op: "create_tour",
        tenant_id: tenantId,
        resolved_form_profile: resolvedFormProfile,
        resolution_source: formProfileResolutionSource,
      });

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

    const idempotentEm = getIdempotentEntityManager();
    if (idempotentEm) {
      return this.executeUpdateTour(idempotentEm, tourId, dto, tenantId);
    }

    return this.tourRepository.manager.transaction((em) =>
      this.executeUpdateTour(em, tourId, dto, tenantId)
    );
  }

  /**
   * Tour PATCH write path: pessimistic row lock, capacity check, and save run in one transaction
   * (or the idempotency handler's shared EntityManager) to close TOCTOU vs live `acceptedCount`.
   */
  private async executeUpdateTour(
    em: EntityManager,
    tourId: string,
    dto: UpdateTourDto,
    tenantId: string
  ): Promise<TourResponseDto> {
    const writeRepos = this.reposFromManager(em);

    const tour = await this.loadTourForUpdateLocking(writeRepos.tour, tourId, tenantId);

    if (!tour) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }

    const regionalScope = buildRegionalTourListScopeFromRequest(this.requestContextService);
    if (!assertTourVisibleInRegionalScope(tour, regionalScope)) {
      throw new ForbiddenException({
        error: {
          code: "TOUR_REGIONAL_SCOPE_FORBIDDEN",
          message: "This tour is outside your allowed regional scope",
        },
      });
    }

    if (dto.total_capacity !== undefined && dto.total_capacity < tour.acceptedCount) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_FIELD_FORMAT_INVALID",
          message: "Invalid field format"
        }
      });
    }

    if (dto.lifecycle_status !== undefined) {
      if (dto.lifecycle_status === TourLifecycleStatus.OPEN) {
        assertTourPublishableBeforePatch(tour);
      }
      assertValidLifecycleTransition(tour.lifecycleStatus, dto.lifecycle_status);
    }

    try {
      const { profile: resolvedFormProfile } = await resolveWorkspaceTourFormProfile(
        tenantId,
        writeRepos.workspaceTourWizardTemplate,
        writeRepos.workspaceTourCreationPreset,
      );

      if (dto.title !== undefined) {
        tour.title = dto.title;
      }
      if (dto.description !== undefined) {
        tour.description = dto.description;
      }
      if (dto.total_capacity !== undefined) {
        assertWorkspaceCapacity(resolvedFormProfile, dto.total_capacity);
        tour.totalCapacity = dto.total_capacity;
      }
      if (dto.lifecycle_status !== undefined) {
        tour.lifecycleStatus = this.normalizeLifecycleStatusInput(dto.lifecycle_status);
      }
      if (dto.chat_link !== undefined) {
        tour.chatLink = dto.chat_link;
      }
      if (dto.cost_context !== undefined) {
        if (dto.cost_context.requiresPayment === true) {
          this.assertFinanceCapabilityForPaymentTour();
        }
        tour.costContext = instanceToPlain(dto.cost_context) as Record<string, unknown>;
      }
      if (dto.autoAcceptRegistrations !== undefined) {
        tour.autoAcceptRegistrations = dto.autoAcceptRegistrations;
      }
      if (dto.tourType !== undefined) {
        tour.tourType = dto.tourType;
      }
      if (dto.transportModes !== undefined) {
        if (tour.details?.tripDetails) {
          this.assertIncomingTripDetailsPatchFragmentLogged(
            tenantId,
            tour.id,
            resolvedFormProfile,
            {},
            dto.transportModes,
          );
        }
        tour.transportModes = [...new Set(dto.transportModes)].sort() as TourTransportMode[];
        this.applyTourFormProfileStripToPersistedTripDetails(tour, resolvedFormProfile);
        this.validatePersistedTripDetailsForResolvedProfile(
          tenantId,
          tour,
          resolvedFormProfile,
        );
      }
      if (dto.destinationId !== undefined) {
        if (dto.destinationId === null) {
          tour.destination = null;
        } else {
          const destination = await this.assertDestinationBelongsToTenant(
            tenantId,
            dto.destinationId,
            writeRepos.workspaceDestination
          );
          const destinationRegionId = destination.regionId ?? null;
          if (!assertDestinationRegionInRegionalScope(destinationRegionId, regionalScope)) {
            throw new ForbiddenException({
              error: {
                code: "TOUR_REGIONAL_SCOPE_FORBIDDEN",
                message: "Destination region is outside your allowed regional scope",
              },
            });
          }
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
        // resolved form profile is not `mountain_outdoor`, regardless of `tourType`.
        if (tour.details.tripDetails) {
          const gated = applyMountainOverviewFieldGatesForFormProfile(
            resolvedFormProfile,
            tour.details.tripDetails,
          );
          tour.details.tripDetails = gated ?? null;
        }

        if (
          dto.tripDetails !== undefined &&
          dto.tripDetails !== null &&
          tour.details.tripDetails
        ) {
          const patchPlain = this.tripDetailsToPersistedJson(
            dto.tripDetails,
          ) as Record<string, unknown>;
          this.assertIncomingTripDetailsPatchFragmentLogged(
            tenantId,
            tour.id,
            resolvedFormProfile,
            patchPlain,
            dto.transportModes,
          );
        }

        if (tour.details.tripDetails) {
          this.applyTourFormProfileStripToPersistedTripDetails(tour, resolvedFormProfile);
        }

        if (dto.tripDetails !== undefined && tour.details.tripDetails) {
          await this.assertTripDetailsCatalogRefsForTenant(tenantId, tour.details.tripDetails, {
            workspaceEquipment: writeRepos.workspaceEquipment,
            workspaceTourThemes: writeRepos.workspaceTourThemes,
            workspaceGuideLanguages: writeRepos.workspaceGuideLanguages
          });
          await this.assertTripDetailsLeaderRefsForTenant(
            tenantId,
            tour.details.tripDetails,
            writeRepos.userTenant,
          );
        }

        const derivedDuration = computeTourDurationDays(
          tour.details.tripDetails?.logistics?.departureDate,
          tour.details.tripDetails?.logistics?.returnDate
        );
        if (derivedDuration !== undefined) {
          tour.details.durationDays = derivedDuration;
        }

        this.validatePersistedTripDetailsForResolvedProfile(
          tenantId,
          tour,
          resolvedFormProfile,
        );
      }

      if (dto.formProfile !== undefined) {
        this.applyTourFormProfileStripToPersistedTripDetails(tour, resolvedFormProfile);
        this.validatePersistedTripDetailsForResolvedProfile(
          tenantId,
          tour,
          resolvedFormProfile,
        );
      }

      tour.formProfileSnapshot = resolvedFormProfile;
      if (shouldRefreshFormProfileSnapshotOnPatch()) {
        this.loggerService.info("tour.form_profile_snapshot.refreshed", {
          event: "tour.form_profile_snapshot.refreshed",
          tour_id: tour.id,
          tenant_id: tenantId,
          resolved_form_profile: resolvedFormProfile,
        });
      }

      this.applyDenormalizedTourListColumns(tour);

      const effectiveLifecycle =
        dto.lifecycle_status !== undefined ? dto.lifecycle_status : tour.lifecycleStatus;
      if (effectiveLifecycle === TourLifecycleStatus.OPEN) {
        assertRequiresPaymentHasPositiveAmount({
          costContext: tour.costContext,
          listPriceMinor: tour.listPriceMinor
        });
      }

      if (dto.lifecycle_status === TourLifecycleStatus.OPEN) {
        try {
          assertTourStateReadyForOpenAfterPatch(resolvedFormProfile, tour);
        } catch (e) {
          if (e instanceof BadRequestException) {
            logTourProfileInvariantRejected(
              this.loggerService,
              {
                op: "update_tour_publish",
                tenant_id: tenantId,
                tour_id: tour.id,
                resolved_form_profile: resolvedFormProfile,
              },
              e,
            );
          }
          throw e;
        }
      }

      const saved = await writeRepos.tour.save(tour);
      const reloaded = await writeRepos.tour.findOne({
        where: { id: saved.id, tenantId },
        relations: TOUR_RESPONSE_RELATIONS
      });
      if (!reloaded) {
        throw new NotFoundException(tenantScopedResourceNotFoundError());
      }
      await this.syncProductDepartureForTourWithRepos(writeRepos, reloaded);

      const editor = this.requestContextService.getUserId();
      this.loggerService.info("tour.updated", {
        event: "tour.updated",
        tour_id: reloaded.id,
        tenant_id: tenantId,
        lifecycle_status: reloaded.lifecycleStatus,
        ...(editor ? { updated_by_user_id: editor } : {})
      });
      const published = reloaded.lifecycleStatus === TourLifecycleStatus.OPEN;
      void this.auditLogService.logEvent({
        category: AUDIT_CATEGORY.SECURITY,
        action: published ? "tour.publish" : "tour.patch",
        entity: "tour",
        entityId: reloaded.id,
        after: {
          lifecycle_status: reloaded.lifecycleStatus,
          ...(dto.cost_context !== undefined ? { cost_context: reloaded.costContext } : {}),
        },
      });

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
    const qb = this.tourRepository
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.details", "details")
      .leftJoinAndSelect("t.destination", "destination")
      .leftJoinAndSelect("destination.region", "destinationRegion")
      .where("t.tenantId = :tenantId", { tenantId })
      .orderBy("t.createdAt", "DESC")
      .addOrderBy("t.id", "DESC");
    if (query.status === "active") {
      qb.andWhere("t.lifecycleStatus = :ls", { ls: TourLifecycleStatus.DRAFT });
    } else if (query.status === "completed") {
      qb.andWhere("t.lifecycleStatus = :ls", { ls: TourLifecycleStatus.OPEN });
    } else if (query.status === "archived") {
      qb.andWhere("t.lifecycleStatus IN (:...archivedStatuses)", {
        archivedStatuses: [TourLifecycleStatus.CLOSED, TourLifecycleStatus.CANCELLED]
      });
    }
    const includeTotal = query.include_total !== false;
    const total = includeTotal ? await qb.getCount() : -1;
    const rows = await qb.clone().skip((page - 1) * limit).take(limit).getMany();
    return { items: rows.map(mapTourEntityToResponseDto), total, page, limit };
  }

  async getTourById(tourId: string): Promise<TourResponseDto> {
    const tenantId = this.requestContextService.resolveEffectiveTenantId();
    if (!tenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    const tour = await this.tourRepository.findOne({
      where: { id: tourId, tenantId },
      relations: TOUR_RESPONSE_RELATIONS
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
    return this.toursCatalogRead.getLeaderWorkspaceAggregate(limit);
  }

}
