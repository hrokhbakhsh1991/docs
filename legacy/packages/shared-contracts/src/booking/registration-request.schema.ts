import { z } from "zod";

import { asciiDigitsFromNationalIdRaw } from "./iran-national-id";
import type { RegistrationIntakeFormValues } from "./registration-intake.schema";

const PARTICIPANT_PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;

export const RegistrationTransportModeSchema = z.enum([
  "self_vehicle",
  "group_vehicle",
  "other",
]);

export const RegistrationEntryModeSchema = z.enum(["telegram", "web"]);

export const RegistrationBookingTargetSchema = z.enum(["self", "guest"]);

/**
 * Wire body for `POST /api/v2/tours/:tourId/register` (Nest `CreateRegistrationDto` subset).
 * Tenant is never accepted from the client.
 */
export const RegistrationRequestSchema = z
  .object({
    tourId: z.string().uuid(),
    participantFullName: z.string().trim().min(1).max(255),
    participantContactPhone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(PARTICIPANT_PHONE_REGEX),
    bookingTarget: RegistrationBookingTargetSchema.optional().default("self"),
    participantNationalId: z
      .string()
      .length(10)
      .regex(/^[0-9]{10}$/)
      .optional(),
    transportMode: RegistrationTransportModeSchema,
    entryMode: RegistrationEntryModeSchema,
    isDriver: z.boolean().optional(),
    plateNumber: z.string().trim().max(32).optional(),
    shareFuelCost: z.boolean().optional(),
    vehicleSeatCapacity: z.number().int().min(1).max(3).optional(),
    participantNote: z.string().trim().max(2000).optional(),
    /** Optional add-on service ids from workspace capability catalog (not persisted on tour yet). */
    selectedServiceIds: z.array(z.string()).optional(),
  })
  .strict();

export type RegistrationRequest = z.infer<typeof RegistrationRequestSchema>;

/** Maps validated intake form values to a strict {@link RegistrationRequest} for the BFF/API. */
export function mapIntakeToRegistrationRequest(
  values: RegistrationIntakeFormValues,
  tourId: string,
): RegistrationRequest {
  const participantNationalId = values.participantNationalId?.trim()
    ? asciiDigitsFromNationalIdRaw(values.participantNationalId.trim())
    : undefined;

  return RegistrationRequestSchema.parse({
    tourId,
    bookingTarget: values.bookingTarget,
    participantFullName: values.participantFullName,
    participantContactPhone: values.participantContactPhone,
    participantNationalId:
      participantNationalId && participantNationalId.length > 0
        ? participantNationalId
        : undefined,
    transportMode: values.transportMode,
    entryMode: "web",
    participantNote: values.participantNote?.trim() || undefined,
    vehicleSeatCapacity: values.vehicleSeatCapacity,
    isDriver: values.isDriver,
    plateNumber: values.plateNumber?.trim() || undefined,
    shareFuelCost: values.shareFuelCost,
  });
}
