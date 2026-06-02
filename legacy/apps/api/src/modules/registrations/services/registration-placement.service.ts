import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { resolveTourAllowPrivateCar } from "@repo/types";

import {
  CreateRegistrationDto,
  RegistrationTransportModeDto,
} from "../dto/create-registration.dto";
import type { ParticipantMetadataDto } from "../dto/participant-metadata.dto";
import { participantMetadataRecordForPersistence } from "../utils/registration-transport-intake";
import { qualifiesForPeakExperienceAutoApproval } from "../utils/peak-experience-placement";
import {
  REGISTRATIONS_TOUR_CATALOG_PORT,
  type RegistrationsTourCatalogPort,
  type TourCatalogSnapshot,
} from "../domain/ports/registrations-tour-catalog.port";
import { RegistrationStatus } from "../registration.entity";

@Injectable()
export class RegistrationPlacementService {
  constructor(
    @Inject(REGISTRATIONS_TOUR_CATALOG_PORT)
    private readonly registrationsTourCatalogPort: RegistrationsTourCatalogPort,
  ) {}

  tourRequiresPayment(costContext: TourCatalogSnapshot["costContext"]): boolean {
    if (costContext == null || typeof costContext !== "object") {
      return false;
    }
    const ctx = costContext as { requiresPayment?: boolean; requires_payment?: boolean };
    return Boolean(ctx.requiresPayment ?? ctx.requires_payment);
  }

  async loadTourTripDetailsForPlacement(
    manager: EntityManager,
    tourId: string,
  ): Promise<Record<string, unknown> | null> {
    const tour = await this.registrationsTourCatalogPort.getTourSnapshot(manager, tourId);
    const raw = tour?.details?.tripDetails;
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    return raw as Record<string, unknown>;
  }

  participantMetadataForPersistence(
    dto: Pick<
      CreateRegistrationDto,
      | "participantMetadata"
      | "transportMode"
      | "isDriver"
      | "plateNumber"
      | "shareFuelCost"
      | "selectedServiceIds"
    >,
  ): Record<string, unknown> | undefined {
    const base = participantMetadataRecordForPersistence({
      participantMetadata: dto.participantMetadata,
      transportMode: dto.transportMode,
      isDriver: dto.isDriver,
      plateNumber: dto.plateNumber,
      shareFuelCost: dto.shareFuelCost,
    });

    const selectedServiceIds = this.normalizeSelectedServiceIds(dto.selectedServiceIds);
    if (selectedServiceIds == null) {
      return base;
    }

    return {
      ...(base ?? {}),
      selectedServiceIds,
    };
  }

  private normalizeSelectedServiceIds(raw: string[] | undefined): string[] | undefined {
    if (raw == null || raw.length === 0) {
      return undefined;
    }
    const ids = raw.map((id) => id.trim()).filter((id) => id.length > 0);
    return ids.length > 0 ? ids : undefined;
  }

  assertPrivateCarRegistrationAllowed(
    tour: TourCatalogSnapshot,
    tripDetails: Record<string, unknown> | null,
    transportMode: RegistrationTransportModeDto | string,
  ): void {
    if (transportMode !== RegistrationTransportModeDto.SELF_VEHICLE) {
      return;
    }
    const allowPrivateCar = resolveTourAllowPrivateCar({
      transportModes: tour.transportModes,
      details: tripDetails != null ? { tripDetails } : undefined,
    });
    if (!allowPrivateCar) {
      throw new BadRequestException({
        error: {
          code: "REGISTRATION_PRIVATE_CAR_NOT_ALLOWED",
          message: "Private car registration is not allowed for this tour",
        },
      });
    }
  }

  resolveInitialRegistrationPlacement(
    tour: TourCatalogSnapshot,
    participantMetadata: ParticipantMetadataDto | Record<string, unknown> | undefined,
    tripDetails: Record<string, unknown> | null,
  ): {
    status: RegistrationStatus;
    consumesAcceptedCapacity: boolean;
  } {
    if (
      qualifiesForPeakExperienceAutoApproval({
        tripDetails,
        participantMetadata: participantMetadata as ParticipantMetadataDto | undefined,
      })
    ) {
      return { status: RegistrationStatus.ACCEPTED, consumesAcceptedCapacity: true };
    }

    const requiresPayment = this.tourRequiresPayment(tour.costContext);
    if (tour.autoAcceptRegistrations === true && !requiresPayment) {
      return { status: RegistrationStatus.ACCEPTED, consumesAcceptedCapacity: true };
    }
    return { status: RegistrationStatus.PENDING, consumesAcceptedCapacity: false };
  }
}
