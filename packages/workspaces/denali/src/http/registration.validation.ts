import {
  classifyPublicRegistrationMobileInput,
  normalizePublicRegistrationMobile,
} from "@app-tour/catalog-registration-auth";
import {
  assertWorkspaceRegistrationContactBasics,
  classifyIranianNationalId,
} from "@app-tour/workspace-sdk";

import { DenaliRegistrationInvalidError } from "./errors/denali-registration-invalid.error";

export type DenaliRegistrationPayload = {
  readonly registrantTarget?: "self" | "other";
  readonly contact: {
    readonly email?: string;
    readonly fullName: string;
    readonly phone?: string;
    readonly nationalId?: string;
    readonly fatherName?: string;
    readonly birthDate?: string;
  };
  readonly partySize: number;
  readonly transport?: {
    readonly kind: "primary" | "personal_car" | "no_car_dong" | "no_car_acquaintance";
    readonly personalCarOccupants?: 1 | 2 | 3;
  };
};

/** Normalize + gate guest/member phone for Denali create. Other requires a valid mobile. */
export function resolveDenaliRegistrationContactPhone(
  registrantTarget: "self" | "other" | undefined,
  rawPhone: string | undefined
): string | undefined {
  const trimmed = rawPhone?.trim() ?? "";
  if (registrantTarget === "other") {
    if (classifyPublicRegistrationMobileInput(trimmed) !== null) {
      throw new DenaliRegistrationInvalidError();
    }
    return normalizePublicRegistrationMobile(trimmed);
  }
  if (trimmed.length === 0) {
    return undefined;
  }
  if (classifyPublicRegistrationMobileInput(trimmed) !== null) {
    throw new DenaliRegistrationInvalidError();
  }
  return normalizePublicRegistrationMobile(trimmed);
}

export function validateDenaliRegistrationPayload(
  payload: DenaliRegistrationPayload,
  context: {
    readonly capacity: number | null;
    readonly nationalIdRequired?: boolean;
    readonly fatherNameRequired?: boolean;
    readonly birthDateRequired?: boolean;
    readonly profileNationalId?: string | null;
    readonly profileFatherName?: string | null;
    readonly profileBirthDate?: string | null;
  }
): void {
  const registrantForOther = payload.registrantTarget === "other";
  const normalizedPhone = resolveDenaliRegistrationContactPhone(
    payload.registrantTarget,
    payload.contact.phone
  );

  assertWorkspaceRegistrationContactBasics({
    email: payload.contact.email,
    emailRequired: false,
    fullName: payload.contact.fullName,
    ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
    partySize: payload.partySize,
    partySizeRequired: true,
    capacity: context.capacity,
    // Capacity / occupancy SoT is Booking capacityPolicy (hybrid: product supplies max only).
    enforcePartySizeCapacity: false,
    createInvalidError: () => new DenaliRegistrationInvalidError(),
  });

  if (context.nationalIdRequired === true) {
    const profileNationalId = context.profileNationalId?.trim() ?? "";
    const intakeNationalId = payload.contact.nationalId?.trim() ?? "";
    const registrantForSelf = !registrantForOther;
    const effectiveNationalId =
      registrantForSelf && profileNationalId.length > 0 ? profileNationalId : intakeNationalId;
    if (classifyIranianNationalId(effectiveNationalId) !== "ok") {
      throw new DenaliRegistrationInvalidError();
    }
  }

  if (context.fatherNameRequired === true) {
    const profileFatherName = context.profileFatherName?.trim() ?? "";
    const intakeFatherName = payload.contact.fatherName?.trim() ?? "";
    const registrantForSelf = !registrantForOther;
    const effectiveFatherName =
      registrantForSelf && profileFatherName.length > 0 ? profileFatherName : intakeFatherName;
    if (effectiveFatherName.length < 1 || effectiveFatherName.length > 200) {
      throw new DenaliRegistrationInvalidError();
    }
  }

  if (context.birthDateRequired === true) {
    const profileBirthDate = context.profileBirthDate?.trim() ?? "";
    const intakeBirthDate = payload.contact.birthDate?.trim() ?? "";
    const registrantForSelf = !registrantForOther;
    const effectiveBirthDate =
      registrantForSelf && profileBirthDate.length > 0 ? profileBirthDate : intakeBirthDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveBirthDate)) {
      throw new DenaliRegistrationInvalidError();
    }
  }
}
