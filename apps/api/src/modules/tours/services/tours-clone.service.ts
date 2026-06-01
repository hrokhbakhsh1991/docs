import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import { instanceToPlain } from "class-transformer";

import {
  buildDenaliClonePresetFromTripDetails,
  cloneTripDetailsWithRemap as safeRemintCloneTripDetailsFromDomain,
  mergeDenaliCanonicalPartial,
  safeDenaliFormToCanonical,
  type DenaliCreateTourPayloadProjection,
  type DenaliCreateTourWizardForm,
} from "@repo/denali-domain";
import { TourLifecycleStatus } from "@repo/domain-contracts";
import { templateToCanonical } from "@repo/types/denali";

import { authRequiredError, tenantContextMissingError } from "../../../common/errors/error-response-builders";
import { LoggerService } from "../../../common/logger/logger.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { TemplateOrchestratorService } from "../../draft-engine/services/template-orchestrator.service";
import {
  WORKSPACE_SETTINGS_REPOSITORY_PORT,
  type WorkspaceSettingsRepositoryPort,
} from "../../settings-locations/domain/ports/workspace-settings-repository.port";
import { FILE_STORAGE_PORT, type FileStoragePort } from "../../../infra/storage/file-storage.port";
import { CreateTourDto } from "../dto/create-tour.dto";
import type { TourResponseDto } from "../dto/tour-response.dto";
import { ToursCatalogReadApplicationService } from "../application/tours-catalog-read.application.service";
import type { TourWriteRecord } from "../domain/tour-write-record.types";
import { ToursService } from "../tours.service";
import { ToursCloneSourceLockService } from "./tours-clone-source-lock.service";
import type { TourTransportMode } from "../tour-transport-modes";
import type { TourType } from "@repo/types";
import {
  CURRENT_TRIP_DETAILS_SCHEMA_VERSION,
} from "../types/trip-details-schema";
import type { TourTripDetails } from "../types/tour-trip-details.types";
import { stripPhotoUrlsFromTripDetails } from "../utils/tour-photo-storage.util";
import { buildTourPhotoCloneCopyPlans } from "../utils/tours-clone-photo-copy.util";
import { TourClonePendingStorageService } from "./tour-clone-pending-storage.service";

export type CloneTripDetailsResult = {
  tripDetails: TourTripDetails;
  photoIdRemap: ReadonlyMap<string, string>;
};

function buildCreateTourDtoFromCloneProjection(input: {
  projection: DenaliCreateTourPayloadProjection;
  clonedTripDetails: TourTripDetails;
  source: TourWriteRecord;
  sourceTourId: string;
}): CreateTourDto {
  const projection = input.projection;
  const costContext =
    input.source.costContext != null && typeof input.source.costContext === "object"
      ? (instanceToPlain(input.source.costContext) as CreateTourDto["cost_context"])
      : undefined;

  const titleBase = input.source.title?.trim() ?? "Tour";
  const dto = new CreateTourDto();
  dto.title = `${titleBase} (Copy)`;
  dto.total_capacity = input.source.totalCapacity;
  dto.lifecycle_status = TourLifecycleStatus.DRAFT;
  dto.description =
    typeof projection.description === "string" ? projection.description : input.source.description ?? undefined;
  dto.chat_link = input.source.chatLink ?? undefined;
  dto.cost_context = costContext;
  dto.autoAcceptRegistrations =
    typeof projection.autoAcceptRegistrations === "boolean"
      ? projection.autoAcceptRegistrations
      : input.source.autoAcceptRegistrations ?? undefined;
  dto.tourType = (projection.tourType as TourType | undefined) ?? input.source.tourType ?? undefined;
  dto.transportModes = Array.isArray(projection.transportModes)
    ? ([...projection.transportModes] as TourTransportMode[])
    : [...input.source.transportModes];
  dto.destinationId = typeof projection.destinationId === "string" ? projection.destinationId : undefined;
  dto.meetingPoint = typeof projection.meetingPoint === "string" ? projection.meetingPoint : undefined;
  dto.durationDays = typeof projection.durationDays === "number" ? projection.durationDays : undefined;
  dto.tripDetails = stripPhotoUrlsFromTripDetails({
    ...input.clonedTripDetails,
    schemaVersion: input.clonedTripDetails.schemaVersion ?? CURRENT_TRIP_DETAILS_SCHEMA_VERSION,
  }) as CreateTourDto["tripDetails"];
  dto.sourceTourId = input.sourceTourId;
  if (Array.isArray(projection.customServiceLabels) && projection.customServiceLabels.length > 0) {
    dto.customServiceLabels = [...projection.customServiceLabels];
  }
  return dto;
}

/**
 * Headless clone uses domain Safe-Remint ({@link safeRemintCloneTripDetailsFromDomain}):
 * catalog FKs verbatim, tour-instance ids reminted, smuggled JSON keys dropped.
 */
@Injectable()
export class ToursCloneService {
  constructor(
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
    @Inject(ToursCatalogReadApplicationService)
    private readonly toursCatalogRead: ToursCatalogReadApplicationService,
    @Inject(WORKSPACE_SETTINGS_REPOSITORY_PORT)
    private readonly settingsRepository: WorkspaceSettingsRepositoryPort,
    @Inject(TemplateOrchestratorService)
    private readonly templateOrchestrator: TemplateOrchestratorService,
    @Inject(FILE_STORAGE_PORT)
    private readonly fileStorage: FileStoragePort,
    @Inject(forwardRef(() => ToursService))
    private readonly toursService: ToursService,
    @Inject(ToursCloneSourceLockService)
    private readonly cloneSourceLock: ToursCloneSourceLockService,
    @Inject(TourClonePendingStorageService)
    private readonly clonePendingStorage: TourClonePendingStorageService,
    @Inject(LoggerService)
    private readonly loggerService: LoggerService,
  ) {}

  cloneTripDetailsWithRemap(
    source: TourTripDetails | null | undefined,
  ): CloneTripDetailsResult | undefined {
    const result = safeRemintCloneTripDetailsFromDomain(
      source as Record<string, unknown> | null | undefined,
    );
    if (!result) {
      return undefined;
    }
    return {
      tripDetails: result.tripDetails as TourTripDetails,
      photoIdRemap: result.photoIdRemap,
    };
  }

  cloneTripDetailsForWizard(source: TourTripDetails | null | undefined): TourTripDetails | undefined {
    return this.cloneTripDetailsWithRemap(source)?.tripDetails;
  }

  /** Maps persisted trip details → wizard preset via Layer C overlay storage paths. */
  tripDetailsToDenaliPresetDefaults(tripDetails: TourTripDetails): DenaliCreateTourWizardForm {
    const storagePaths = this.templateOrchestrator.listModernOverlayStoragePaths();
    const td = this.cloneTripDetailsForWizard(tripDetails);
    if (!td) {
      return buildDenaliClonePresetFromTripDetails({}, { storagePaths });
    }
    return buildDenaliClonePresetFromTripDetails(td as Record<string, unknown>, { storagePaths });
  }

  /**
   * Headless clone: source tour trip_details → target workspace template orchestration → new tour row.
   * Storage copies run before DB persist; {@link TourClonePendingStorageService} rows are always
   * released in `finally`. Orphan dest keys are cleaned only when no `tours` row matches the path.
   */
  async cloneTour(
    sourceTourId: string,
    options: { targetWorkspaceId: string },
  ): Promise<TourResponseDto> {
    const requestTenantId = this.requestContext.resolveEffectiveTenantId();
    if (!requestTenantId) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    if (!this.requestContext.getUserId()) {
      throw new ForbiddenException(authRequiredError());
    }

    const targetWorkspaceId = options.targetWorkspaceId.trim();
    if (targetWorkspaceId !== requestTenantId) {
      throw new BadRequestException({
        error: {
          code: "TOUR_CLONE_WORKSPACE_MISMATCH",
          message: "Clone target workspace must match the active tenant context",
        },
      });
    }

    const trimmedSourceId = sourceTourId.trim();

    return this.cloneSourceLock.withSourceCloneLock(
      trimmedSourceId,
      targetWorkspaceId,
      async () => this.executeCloneTour(trimmedSourceId, targetWorkspaceId),
    );
  }

  private async executeCloneTour(
    trimmedSourceId: string,
    targetWorkspaceId: string,
  ): Promise<TourResponseDto> {
    const assignedTourId = randomUUID();
    const cloneOperationId = randomUUID();
    let created: TourResponseDto | undefined;

    try {
      const source = await this.toursCatalogRead.getTourEntityById(trimmedSourceId);
      const sourceTripDetails = source.details?.tripDetails ?? null;
      const cloneResult = this.cloneTripDetailsWithRemap(sourceTripDetails);
      if (!cloneResult) {
        throw new BadRequestException({
          error: {
            code: "TOUR_CLONE_EMPTY_SOURCE",
            message: "Source tour has no trip details to clone",
          },
        });
      }

      const template = await this.settingsRepository.findTourWizardTemplateByWorkspace(targetWorkspaceId);
      if (!template) {
        throw new NotFoundException({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: "Workspace tour wizard template is not configured",
          },
        });
      }

      const cloneForm = buildDenaliClonePresetFromTripDetails(
        cloneResult.tripDetails as Record<string, unknown>,
        { storagePaths: this.templateOrchestrator.listModernOverlayStoragePaths() },
      );
      const templateCanonical = templateToCanonical({
        canonicalData: template.canonicalData,
        fieldRulesOverlay: template.fieldRulesOverlay,
      }) as Parameters<typeof mergeDenaliCanonicalPartial>[0];
      const cloneCanonical = safeDenaliFormToCanonical(cloneForm);
      const mergedCanonical = mergeDenaliCanonicalPartial(templateCanonical, cloneCanonical);

      const orchestration = await this.templateOrchestrator.createDraftFromTemplate(
        {
          workspaceId: template.workspaceId,
          templateId: template.id,
          canonicalData: mergedCanonical as unknown as Record<string, unknown>,
          fieldRulesOverlay: template.fieldRulesOverlay ?? {},
        },
        { submitGradeProjection: true },
      );

      if (!orchestration.success) {
        throw new BadRequestException({
          error: {
            code: "TOUR_CLONE_ORCHESTRATION_FAILED",
            message: "Template orchestration failed for cloned tour",
            details: { errors: orchestration.errors ?? [] },
          },
        });
      }

      const createDto = buildCreateTourDtoFromCloneProjection({
        projection: orchestration.payload,
        clonedTripDetails: cloneResult.tripDetails,
        source,
        sourceTourId: trimmedSourceId,
      });

      const copyPlans = buildTourPhotoCloneCopyPlans({
        workspaceId: targetWorkspaceId,
        sourceTourId: trimmedSourceId,
        destTourId: assignedTourId,
        sourceTripDetails,
        photoIdRemap: cloneResult.photoIdRemap,
      });

      await this.clonePendingStorage.executeCloneCopiesWithSaga({
        tenantId: targetWorkspaceId,
        cloneOperationId,
        fileStorage: this.fileStorage,
        plans: copyPlans,
      });
      created = await this.toursService.createTour(createDto, { assignedTourId });
      return created;
    } finally {
      try {
        await this.clonePendingStorage.releaseCloneOperation(targetWorkspaceId, cloneOperationId, {
          destinationTourId: created ? assignedTourId : undefined,
          fileStorage: this.fileStorage,
        });
      } catch (releaseError: unknown) {
        const message =
          releaseError instanceof Error ? releaseError.message : String(releaseError);
        this.loggerService.error("tour.clone.release_clone_operation_failed", {
          event: "tour.clone.release_clone_operation_failed",
          code: "TOUR_CLONE_RELEASE_FAILED",
          tenant_id: targetWorkspaceId,
          clone_operation_id: cloneOperationId,
          destination_tour_id: created ? assignedTourId : undefined,
          error: message,
        });
      }
    }
  }
}
