/**
 * Denali wizard → create-tour API (1:1 mapper only).
 *
 * Business rules: {@link ./buildDenaliCreateTourPayloadProjection.ts}
 */

import type { CreateTourDto } from "@/lib/services/tours.service";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import {
  buildDenaliCreateTourPayloadProjection,
  type DenaliCreateTourPayloadProjection,
} from "./buildDenaliCreateTourPayloadProjection";

export {
  denaliTourKindToApiTourType,
  splitIsoDateTime,
} from "./buildDenaliCreateTourPayloadProjection";

/** 1:1 copy from resolved projection → {@link CreateTourDto} (no business rules). */
export function mapDenaliCreateTourPayloadProjectionToDto(
  projection: DenaliCreateTourPayloadProjection,
): CreateTourDto {
  return {
    title: projection.title,
    description: projection.description,
    tourType: projection.tourType,
    destinationId: projection.destinationId,
    capacity: projection.capacity,
    price: projection.price,
    autoAcceptRegistrations: projection.autoAcceptRegistrations,
    lifecycle_status: projection.lifecycle_status,
    tripDetails: projection.tripDetails,
    durationDays: projection.durationDays,
    requiresPayment: projection.requiresPayment,
    paymentMode: projection.paymentMode,
    meetingPoint: projection.meetingPoint,
    communicationLink: projection.communicationLink,
    transportModes: projection.transportModes,
    ...(projection.customServiceLabels && projection.customServiceLabels.length > 0
      ? { customServiceLabels: [...projection.customServiceLabels] }
      : {}),
  };
}

/**
 * Maps Denali wizard form → {@link CreateTourDto} via projection build + 1:1 mapper.
 */
export function mapDenaliWizardToCreateTourPayload(form: DenaliCreateTourWizardForm): CreateTourDto {
  return mapDenaliCreateTourPayloadProjectionToDto(buildDenaliCreateTourPayloadProjection(form));
}
