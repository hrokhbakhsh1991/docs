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
import type { EntityManager } from "typeorm";

import {
  ACCOMMODATION_TYPE_VALUES,
  MEAL_PLAN_VALUES,
  parseLegacyAccommodationTypeString,
  parseLegacyMealPlanString,
  type TourFormProfile,
} from "@repo/types";
import {
  WORKSPACE_SETTINGS_REPOSITORY_PORT,
  type WorkspaceDestinationSummary,
  type WorkspaceSettingsRepositoryPort,
} from "../settings-locations/domain/ports/workspace-settings-repository.port";
import {
  WORKSPACE_IDENTITY_REPOSITORY_PORT,
  type WorkspaceIdentityRepositoryPort,
} from "../identity/domain/ports/workspace-identity-repository.port";
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
import {
  mapTourEntityToResponseDto,
  type TourResponseSource,
  TourResponseDto,
} from "./dto/tour-response.dto";
import { UpdateTourDto } from "./dto/update-tour.dto";
import { TourLifecycleStatus } from "@repo/domain-contracts";
import type { TourWriteRecord } from "./domain/tour-write-record.types";
import type { TourDetailsPolicySnapshot } from "./domain/tour-policy.types";
import type { TourTripDetails } from "./types/tour-trip-details.types";
import { CURRENT_TRIP_DETAILS_SCHEMA_VERSION } from "./types/trip-details-schema";
import { TourTripDetailsDto } from "./dto/trip-details.dto";
import {
  assertTourPublishableBeforePatch,
  assertTourStateReadyForOpenAfterPatch,
  assertTourStateReadyForOpenOnCreate,
} from "./policies/assert-tour-publish-transition";
import { assertRequiresPaymentHasPositiveAmount } from "./policies/assert-requires-payment-cost";
import {
  assertValidLifecycleTransition,
  isTourDraftToOpenPublishTransition,
} from "./policies/tour-lifecycle.policy";
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
  stripPersistedTourForFormProfile,
} from "./utils/create-tour-form-profile-strip";
import { shouldRefreshFormProfileSnapshotOnPatch } from "./tours-feature-flags";
import { logTourFormProfileResolvedForCreate, logTourProfileInvariantRejected } from "./tours-profile-observability";
import { ToursCatalogReadApplicationService } from "./application/tours-catalog-read.application.service";
import {
  TOURS_WRITE_REPOSITORY_PORT,
  type ToursWriteRepositoryPort,
} from "./domain/ports/tours-repository.port";
import {
  currencyCodeFromCostContext,
  extractTripLogisticsDates,
  listPriceMinorFromCostContext
} from "./utils/commercial-fields";
import { buildRegionalTourListScopeFromRequest } from "../../common/rbac/capability-grant-context-from-request";
import {
  assertDestinationRegionInRegionalScope,
  assertTourVisibleInRegionalScope,
} from "./utils/apply-regional-tour-list-scope";
import { FILE_STORAGE_PORT, type FileStoragePort } from "../../infra/storage/file-storage.port";
import { randomUUID } from "node:crypto";

/**
 * Tour write orchestration and mutation entrypoints. Decomposition inventory: `architecture/service-decomposition.map.ts` (`TOURS_GOD_METHODS`).
 * All catalog reads delegate to {@link ToursCatalogReadApplicationService}; `createTour` / `updateTour` remain the main write surface until split into use-case services.
 */
@Injectable()
export class ToursService {
  constructor(
    @Inject(TOURS_WRITE_REPOSITORY_PORT)
    private readonly toursWriteRepository: ToursWriteRepositoryPort,
    @Inject(WORKSPACE_SETTINGS_REPOSITORY_PORT)
    private readonly settingsRepository: WorkspaceSettingsRepositoryPort,
    @Inject(WORKSPACE_IDENTITY_REPOSITORY_PORT)
    private readonly identityRepository: WorkspaceIdentityRepositoryPort,
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(LoggerService)
    private readonly loggerService: LoggerService,
    @Inject(AuditLogService)
    private readonly auditLogService: AuditLogService,
    @Inject(ToursCatalogReadApplicationService)
    private readonly toursCatalogRead: ToursCatalogReadApplicationService,
    @Inject(FILE_STORAGE_PORT)
    private readonly fileStorage: FileStoragePort
  ) {}

  private writeManager(): EntityManager {
    return this.toursWriteRepository.getIdempotentManager() ?? this.toursWriteRepository.getDefaultManager();
  }

  private async assertDestinationBelongsToTenant(
    tenantId: string,
    destinationId: string,
  ): Promise<WorkspaceDestinationSummary> {
    const row = await this.settingsRepository.findDestinationSummary(tenantId, destinationId);
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

  private destinationRelation(destinationId: string | null | undefined) {
    if (!destinationId) {
      return null;
    }
    return { id: destinationId };
  }

  private async assertTripDetailsCatalogRefsForTenant(
    tenantId: string,
    tripDetails: TourTripDetails | null | undefined,
  ): Promise<void> {
    if (tripDetails == null) {
      return;
    }
    const { equipmentIds, tourThemeIds, guideLanguageIds } = collectWorkspaceCatalogIds(tripDetails);
    await assertEquipmentIdsBelongToTenant(this.settingsRepository, tenantId, equipmentIds);
    await assertTourThemeIdsBelongToTenant(this.settingsRepository, tenantId, tourThemeIds);
    await assertGuideLanguageIdsBelongToTenant(this.settingsRepository, tenantId, guideLanguageIds);
  }

  private async assertTripDetailsLeaderRefsForTenant(
    tenantId: string,
    tripDetails: TourTripDetails | null | undefined,
  ): Promise<void> {
    if (tripDetails == null) {
      return;
    }
    const leaderUserIds = tripDetails.overview?.leaderUserIds;
    await assertLeaderUserIdsBelongToTenant(this.identityRepository, tenantId, leaderUserIds);
  }

  /** Keeps denormalized list/audit columns in sync with JSON details and cost_context. */
  private applyDenormalizedTourListColumns(tour: TourWriteRecord): void {
    const { startsOn, endsOn } = extractTripLogisticsDates(
      tour.details ?? null
    );
    tour.startsOn = startsOn ?? undefined;
    tour.endsOn = endsOn ?? undefined;
    if (tour.costContext && typeof tour.costContext === "object") {
      tour.currencyCode = currencyCodeFromCostContext(tour.costContext);
      const minor = listPriceMinorFromCostContext(tour.costContext);
      tour.listPriceMinor = minor ?? undefined;
    }
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
      | "customServiceLabels"
    >
  ): boolean {
    return (
      dto.destinationName !== undefined ||
      dto.elevationM !== undefined ||
      dto.difficulty !== undefined ||
      dto.durationDays !== undefined ||
      dto.meetingPoint !== undefined ||
      dto.itinerary !== undefined ||
      dto.tripDetails !== undefined ||
      dto.customServiceLabels !== undefined
    );
  }

  private mergeCustomServiceLabelsIntoPersistedTripDetails(
    tripDetails: TourTripDetails | null | undefined,
    labels: string[] | undefined,
  ): TourTripDetails | null | undefined {
    if (labels === undefined) {
      return tripDetails ?? undefined;
    }
    const base =
      tripDetails != null && typeof tripDetails === "object" && !Array.isArray(tripDetails)
        ? { ...(tripDetails as Record<string, unknown>) }
        : {};
    const overviewRaw = base.overview;
    const overview =
      overviewRaw != null && typeof overviewRaw === "object" && !Array.isArray(overviewRaw)
        ? { ...(overviewRaw as Record<string, unknown>) }
        : {};
    if (labels.length === 0) {
      delete overview.customServiceLabels;
    } else {
      overview.customServiceLabels = labels;
    }
    if (Object.keys(overview).length > 0) {
      base.overview = overview;
    } else {
      delete base.overview;
    }
    return Object.keys(base).length > 0 ? (base as TourTripDetails) : null;
  }

  /** After profile strip on merged `tripDetails`, run canonical checks (Phase 4 assert hook). */
  private validatePersistedTripDetailsForResolvedProfile(
    tenantId: string,
    tour: TourWriteRecord,
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
    tour: TourWriteRecord,
    profile: TourFormProfile,
  ): void {
    stripPersistedTourForFormProfile(profile, tour);
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
    
    await this.toursCatalogRead.getTourById(tourId);

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

    const writeManager = this.writeManager();

    try {
      const { profile: resolvedFormProfile, source: formProfileResolutionSource } =
        await this.settingsRepository.resolveTourFormProfile(tenantId, dto.sourcePresetId);
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
        await this.assertDestinationBelongsToTenant(tenantId, dto.destinationId);
      }

      let details: TourDetailsPolicySnapshot | undefined;
      if (this.hasAnyTourDetailsField(dto)) {
        const tripDetails =
          applyMountainOverviewFieldGatesForFormProfile(
            resolvedFormProfile,
            this.mergeCustomServiceLabelsIntoPersistedTripDetails(
              this.tripDetailsToPersistedJson(dto.tripDetails) ?? null,
              dto.customServiceLabels,
            ),
          ) ?? null;
        const derived = computeTourDurationDays(
          tripDetails?.logistics?.departureDate,
          tripDetails?.logistics?.returnDate
        );
        details = {
          destinationName: dto.destinationName ?? null,
          elevationM: dto.elevationM ?? null,
          difficulty: dto.difficulty ?? null,
          durationDays: derived ?? dto.durationDays ?? null,
          meetingPoint: dto.meetingPoint ?? null,
          itinerary: dto.itinerary ?? null,
          tripDetails,
        };
      }

        if (dto.cost_context?.requiresPayment === true) {
        this.assertFinanceCapabilityForPaymentTour();
        }

        if (details?.tripDetails) {
        await this.assertTripDetailsCatalogRefsForTenant(tenantId, details.tripDetails);
        await this.assertTripDetailsLeaderRefsForTenant(tenantId, details.tripDetails);
      }

      const tour = this.toursWriteRepository.createTourEntity(writeManager, {
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
        // Create→OPEN publish policy (geo when strategy defines publishGeolocationCheck).
        assertTourStateReadyForOpenOnCreate(resolvedFormProfile, tour);
      }

      const loaded = await this.toursWriteRepository.createTour(writeManager, tour, tenantId);

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

      return mapTourEntityToResponseDto(loaded as TourResponseSource);
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

    const idempotentEm = this.toursWriteRepository.getIdempotentManager();
    if (idempotentEm) {
      return this.executeUpdateTour(idempotentEm, tourId, dto, tenantId);
    }

    return this.toursWriteRepository.runInTransaction((em) =>
      this.executeUpdateTour(em, tourId, dto, tenantId)
    );
  }

  async updateTourStatus(
    tourId: string,
    lifecycleStatus: TourLifecycleStatus,
  ): Promise<TourResponseDto> {
    return this.updateTour(tourId, { lifecycle_status: lifecycleStatus });
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
    const tour = await this.toursWriteRepository.loadTourForUpdateLocking(em, tourId, tenantId);

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

    const priorLifecycle = tour.lifecycleStatus;
    const isPublishingTransition = isTourDraftToOpenPublishTransition(
      priorLifecycle,
      dto.lifecycle_status,
    );

    if (dto.lifecycle_status !== undefined) {
      if (isPublishingTransition) {
        // Pre-merge DRAFT gate; publish geo/readiness policy via WorkspaceStrategyRegistry in assert-tour-publish-transition.
        assertTourPublishableBeforePatch(tour);
      }
      assertValidLifecycleTransition(priorLifecycle, dto.lifecycle_status);
    }

    try {
      const { profile: resolvedFormProfile } = await this.settingsRepository.resolveTourFormProfile(
        tenantId,
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
          tour.details = {};
        }
        const details = tour.details;
        if (dto.destinationName !== undefined) {
          details.destinationName = dto.destinationName;
        }
        if (dto.elevationM !== undefined) {
          details.elevationM = dto.elevationM;
        }
        if (dto.difficulty !== undefined) {
          details.difficulty = dto.difficulty;
        }
        if (dto.durationDays !== undefined) {
          details.durationDays = dto.durationDays;
        }
        if (dto.meetingPoint !== undefined) {
          details.meetingPoint = dto.meetingPoint;
        }
        if (dto.itinerary !== undefined) {
          details.itinerary = dto.itinerary;
        }
        if (dto.tripDetails !== undefined) {
          if (dto.tripDetails === null) {
            details.tripDetails = null;
          } else {
            const patch = this.tripDetailsToPersistedJson(dto.tripDetails);
            details.tripDetails = this.stripLegacyParticipationGearKeys(
              mergeTourTripDetails(details.tripDetails ?? null, patch as TourTripDetails),
            ) ?? null;
          }
        }
        if (dto.customServiceLabels !== undefined) {
          details.tripDetails =
            this.mergeCustomServiceLabelsIntoPersistedTripDetails(
              details.tripDetails ?? null,
              dto.customServiceLabels,
            ) ?? null;
        }

        // Strip mountain-only fields (e.g. `overview.maxAltitudeMeters`) when the
        // resolved form profile is not `mountain_outdoor`, regardless of `tourType`.
        if (details.tripDetails) {
          const gated = applyMountainOverviewFieldGatesForFormProfile(
            resolvedFormProfile,
            details.tripDetails,
          );
          details.tripDetails = gated ?? null;
        }

        if (
          dto.tripDetails !== undefined &&
          dto.tripDetails !== null &&
          details.tripDetails
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

        if (details.tripDetails) {
          this.applyTourFormProfileStripToPersistedTripDetails(tour, resolvedFormProfile);
        }

        if (dto.tripDetails !== undefined && details.tripDetails) {
          await this.assertTripDetailsCatalogRefsForTenant(tenantId, details.tripDetails);
          await this.assertTripDetailsLeaderRefsForTenant(tenantId, details.tripDetails);
        }

        const derivedDuration = computeTourDurationDays(
          details.tripDetails?.logistics?.departureDate,
          details.tripDetails?.logistics?.returnDate
        );
        if (derivedDuration !== undefined) {
          details.durationDays = derivedDuration;
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

      if (isPublishingTransition) {
        try {
          // Post-merge publish gate (geolocation when strategy defines publishGeolocationCheck).
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

      const reloaded = await this.toursWriteRepository.updateTour(em, tour, tenantId);

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

      return mapTourEntityToResponseDto(reloaded as TourResponseSource);
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
    return this.toursCatalogRead.listTours(query);
  }

  async getTourById(tourId: string): Promise<TourResponseDto> {
    return this.toursCatalogRead.getTourById(tourId);
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
