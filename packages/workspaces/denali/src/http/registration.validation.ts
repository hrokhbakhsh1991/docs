import {
  assertWorkspaceRegistrationContactBasics,
} from "@app-tour/workspace-sdk";

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
  },
): void {
  assertWorkspaceRegistrationContactBasics({
    email: payload.contact.email,
    emailRequired: false,
    fullName: payload.contact.fullName,
    ...(payload.contact.phone === undefined ? {} : { phone: payload.contact.phone }),
    partySize: payload.partySize,
    partySizeRequired: true,
    capacity: context.capacity,
    // Capacity / occupancy SoT is Booking capacityPolicy (hybrid: product supplies max only).
    enforcePartySizeCapacity: false,
    createInvalidError: () => new Error("DENALI_REGISTRATION_INVALID"),
  });

  if (context.nationalIdRequired === true) {
    const profileNationalId = context.profileNationalId?.trim() ?? "";
    const intakeNationalId = payload.contact.nationalId?.trim() ?? "";
    const registrantForSelf = payload.registrantTarget !== "other";
    const effectiveNationalId =
      registrantForSelf && profileNationalId.length > 0 ? profileNationalId : intakeNationalId;
    if (!/^\d{10}$/.test(effectiveNationalId)) {
      throw new Error("DENALI_REGISTRATION_INVALID");
    }
  }

  if (context.fatherNameRequired === true) {
    const profileFatherName = context.profileFatherName?.trim() ?? "";
    const intakeFatherName = payload.contact.fatherName?.trim() ?? "";
    const registrantForSelf = payload.registrantTarget !== "other";
    const effectiveFatherName =
      registrantForSelf && profileFatherName.length > 0 ? profileFatherName : intakeFatherName;
    if (effectiveFatherName.length < 1 || effectiveFatherName.length > 200) {
      throw new Error("DENALI_REGISTRATION_INVALID");
    }
  }

  if (context.birthDateRequired === true) {
    const profileBirthDate = context.profileBirthDate?.trim() ?? "";
    const intakeBirthDate = payload.contact.birthDate?.trim() ?? "";
    const registrantForSelf = payload.registrantTarget !== "other";
    const effectiveBirthDate =
      registrantForSelf && profileBirthDate.length > 0 ? profileBirthDate : intakeBirthDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveBirthDate)) {
      throw new Error("DENALI_REGISTRATION_INVALID");
    }
  }
}
