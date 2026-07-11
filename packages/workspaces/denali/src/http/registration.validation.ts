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

const DENALI_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DENALI_PHONE_PATTERN = /^[\d+\-().\s]*$/;

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
  const email = payload.contact.email?.trim() ?? "";
  if (
    email.length > 0 &&
    (email.length < 3 || email.length > 320 || !DENALI_EMAIL_PATTERN.test(email))
  ) {
    throw new Error("DENALI_REGISTRATION_INVALID");
  }
  const fullName = payload.contact.fullName.trim();
  if (fullName.length < 1 || fullName.length > 200) {
    throw new Error("DENALI_REGISTRATION_INVALID");
  }
  if (payload.contact.phone !== undefined) {
    const phone = payload.contact.phone.trim();
    if (phone.length > 32 || !DENALI_PHONE_PATTERN.test(phone)) {
      throw new Error("DENALI_REGISTRATION_INVALID");
    }
  }
  if (!Number.isInteger(payload.partySize) || payload.partySize < 1) {
    throw new Error("DENALI_REGISTRATION_INVALID");
  }
  if (context.capacity !== null && payload.partySize > context.capacity) {
    throw new Error("DENALI_REGISTRATION_INVALID");
  }

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
