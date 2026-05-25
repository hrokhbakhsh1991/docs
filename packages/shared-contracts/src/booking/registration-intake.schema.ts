import { z } from "zod";

import { asciiDigitsFromNationalIdRaw, isValidIranNationalIdChecksum } from "./iran-national-id";
import type { RegistrationFieldPolicy } from "./registration-field-policy";

const PARTICIPANT_PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;

export const TransportSchema = z.object({
  isDriver: z.boolean().optional(),
  plateNumber: z.string().trim().optional(),
  shareFuelCost: z.boolean().optional(),
});

export type RegistrationIntakeSchemaMessages = {
  fullNameRequired: string;
  phoneRequired: string;
  phoneTooLong: string;
  phoneFormat: string;
  nationalIdRequired: string;
  nationalIdInvalid: string;
  peaksRequired: string;
  seatOnlySelfVehicle: string;
  seatRange: string;
  isDriverRequired: string;
  plateNumberRequired: string;
  shareFuelCostRequired: string;
  privateCarNotAllowedOnTour: string;
  sportsInsuranceRequired: string;
};

function registrationIntakeCoreShape(messages: RegistrationIntakeSchemaMessages) {
  return {
    bookingTarget: z.enum(["self", "guest"]),
    participantFullName: z.string().trim().min(1, messages.fullNameRequired).max(255),
    participantContactPhone: z
      .string()
      .trim()
      .min(1, messages.phoneRequired)
      .max(64, messages.phoneTooLong)
      .regex(PARTICIPANT_PHONE_REGEX, messages.phoneFormat),
    participantNationalId: z.string(),
    transportMode: z.enum(["self_vehicle", "group_vehicle", "other"]),
    participantNote: z.string().trim().max(2000).optional(),
    vehicleSeatCapacity: z.number().int().min(1, messages.seatRange).max(3, messages.seatRange).optional(),
    userPastPeaksCount: z.number().int().min(0).max(4).optional(),
    sportsInsurance: z.boolean().optional(),
  };
}

type TransportIntakeData = z.infer<typeof TransportSchema> & {
  transportMode: string;
  vehicleSeatCapacity?: number;
};

function refineRegistrationIntakeTransportPolicy(
  data: TransportIntakeData,
  ctx: z.RefinementCtx,
  policy: RegistrationFieldPolicy,
  messages: RegistrationIntakeSchemaMessages,
): void {
  if (policy.allowPrivateCar) {
    return;
  }
  if (data.transportMode === "self_vehicle") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: messages.privateCarNotAllowedOnTour,
      path: ["transportMode"],
    });
  }
  const hasPrivateCarFields =
    data.isDriver !== undefined ||
    (data.plateNumber != null && data.plateNumber.trim().length > 0) ||
    data.vehicleSeatCapacity != null ||
    data.shareFuelCost !== undefined;
  if (hasPrivateCarFields) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: messages.privateCarNotAllowedOnTour,
      path: ["transportMode"],
    });
  }
}

function refineRegistrationIntakeTransport(
  data: TransportIntakeData,
  ctx: z.RefinementCtx,
  messages: RegistrationIntakeSchemaMessages,
): void {
  if (data.transportMode === "self_vehicle") {
    if (data.isDriver === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: messages.isDriverRequired,
        path: ["isDriver"],
      });
    } else if (data.isDriver) {
      if (!data.plateNumber || data.plateNumber.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: messages.plateNumberRequired,
          path: ["plateNumber"],
        });
      }
      if (data.vehicleSeatCapacity === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: messages.seatRange,
          path: ["vehicleSeatCapacity"],
        });
      }
    }
  } else if (data.vehicleSeatCapacity != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: messages.seatOnlySelfVehicle,
      path: ["vehicleSeatCapacity"],
    });
  }
}

function refineRegistrationIntakePolicy(
  data: {
    bookingTarget: "self" | "guest";
    participantNationalId: string;
    userPastPeaksCount?: number;
    sportsInsurance?: boolean;
  },
  ctx: z.RefinementCtx,
  policy: RegistrationFieldPolicy,
  messages: RegistrationIntakeSchemaMessages,
): void {
  if (policy.sportsInsuranceRequired && data.sportsInsurance !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: messages.sportsInsuranceRequired,
      path: ["sportsInsurance"],
    });
  }

  if (policy.requirePeakHistory && data.userPastPeaksCount === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: messages.peaksRequired,
      path: ["userPastPeaksCount"],
    });
  }

  if (!policy.nationalIdRequired) {
    return;
  }

  if (data.bookingTarget === "self" && policy.profileNationalIdPresent) {
    return;
  }

  const nid = asciiDigitsFromNationalIdRaw(data.participantNationalId.trim());
  if (nid.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: messages.nationalIdRequired,
      path: ["participantNationalId"],
    });
    return;
  }
  if (nid.length !== 10 || !isValidIranNationalIdChecksum(nid)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: messages.nationalIdInvalid,
      path: ["participantNationalId"],
    });
  }
}

export function buildRegistrationIntakeSchema(
  policy: RegistrationFieldPolicy,
  messages: RegistrationIntakeSchemaMessages,
) {
  return z
    .object(registrationIntakeCoreShape(messages))
    .merge(TransportSchema)
    .superRefine((data, ctx) => {
      refineRegistrationIntakeTransportPolicy(data, ctx, policy, messages);
      if (policy.allowPrivateCar) {
        refineRegistrationIntakeTransport(data, ctx, messages);
      }
      refineRegistrationIntakePolicy(data, ctx, policy, messages);
    });
}

export type RegistrationIntakeFormValues = z.infer<ReturnType<typeof buildRegistrationIntakeSchema>>;
