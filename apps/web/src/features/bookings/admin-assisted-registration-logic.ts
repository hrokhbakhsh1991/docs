import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";

export type WorkspaceRegistrationTransportMode =
  | "none"
  | "organizer_vehicle"
  | "bus"
  | "minibus"
  | "train"
  | "shared_cars";

export type WorkspaceRegistrationTransportKind =
  | "primary"
  | "personal_car"
  | "no_car_dong"
  | "no_car_acquaintance";

export type WorkspaceAdminRegistrationRequirements = {
  readonly title: string;
  readonly departureAt: string | null;
  readonly capacityMax: number | null;
  readonly basePricePerPerson: number | null;
  readonly registrationApprovalMode: "manual" | "auto";
  readonly participantRequirements: {
    readonly nationalIdRequired: boolean;
    readonly fatherNameRequired: boolean;
    readonly birthDateRequired: boolean;
  };
  readonly transport: {
    readonly mode: WorkspaceRegistrationTransportMode;
    readonly allowPersonalCar: boolean;
    readonly transportCostAmount: number | null;
    readonly dongAmount: number | null;
  };
};

export type AdminAssistedRegistrationStep =
  | "identity"
  | "requirements"
  | "logistics"
  | "review";

export type AdminAssistedRegistrationFormState = {
  readonly registrantMode: "member" | "guest";
  readonly memberUserId: string;
  readonly memberDisplayName: string;
  readonly guestLabel: string;
  readonly guestPhone: string;
  readonly guestEmail: string;
  readonly partySize: string;
  readonly nationalId: string;
  readonly fatherName: string;
  readonly birthDate: string;
  readonly paymentStatus: "unpaid" | "partial" | "paid";
  readonly transportKind: WorkspaceRegistrationTransportKind;
  readonly personalCarOccupants: "" | "1" | "2" | "3";
  readonly approveNow: boolean;
};

export type AdminAssistedRegistrationValidationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly field: keyof AdminAssistedRegistrationFormState;
      readonly message: string;
    };

export type AdminAssistedRegistrationCreatePayload = {
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly guestPhone: string;
  readonly guestEmail?: string;
  readonly memberUserId?: string;
  readonly partySize: number;
  readonly departureAt: string;
  readonly paymentStatus: "unpaid" | "partial" | "paid";
  readonly registrationIntake: Readonly<Record<string, unknown>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((cursor, segment) => {
    if (!isRecord(cursor)) {
      return undefined;
    }
    return cursor[segment];
  }, data);
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function resolveAdminRegistrationApprovalMode(data: Record<string, unknown>): "manual" | "auto" {
  const raw =
    readString(readCanonicalPath(data, "pricing.registrationApproval")) ??
    readString(readCanonicalPath(data, "pricingPayment.registrationApproval"));
  if (raw === "auto") {
    return "auto";
  }
  if (raw != null) {
    return "manual";
  }
  const flag = data.requiresManualAdminApproval;
  if (flag === true || flag === "true") {
    return "manual";
  }
  if (flag === false || flag === "false") {
    return "auto";
  }
  return "manual";
}

function readInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Number.isInteger(value) ? value : Math.trunc(value);
}

export function extractWorkspaceAdminRegistrationRequirements(
  detail: OperatorTourDetailResponse
): WorkspaceAdminRegistrationRequirements {
  const data = detail.canonical.data;
  const title = readString(data.title) ?? detail.projection.title;
  const transportModeRaw =
    readString(readCanonicalPath(data, "transport.mode")) ??
    readString(readCanonicalPath(data, "details.tripDetails.transportModes")) ??
    "none";
  const transportMode = (
    ["none", "organizer_vehicle", "bus", "minibus", "train", "shared_cars"] as const
  ).includes(transportModeRaw as WorkspaceRegistrationTransportMode)
    ? (transportModeRaw as WorkspaceRegistrationTransportMode)
    : "none";

  return {
    title,
    departureAt: readString(data.startDateTime) ?? detail.projection.departureAt,
    capacityMax: readInteger(data.capacityMax) ?? detail.projection.totalCapacity,
    basePricePerPerson: readInteger(readCanonicalPath(data, "pricing.basePricePerPerson")),
    registrationApprovalMode: resolveAdminRegistrationApprovalMode(data),
    participantRequirements: {
      nationalIdRequired:
        readBoolean(readCanonicalPath(data, "participantRequirements.nationalIdRequired")) ||
        readBoolean(readCanonicalPath(data, "participants.nationalIdRequired")),
      fatherNameRequired:
        readBoolean(readCanonicalPath(data, "participantRequirements.fatherNameRequired")) ||
        readBoolean(readCanonicalPath(data, "participants.fatherNameRequired")),
      birthDateRequired:
        readBoolean(readCanonicalPath(data, "participantRequirements.birthDateRequired")) ||
        readBoolean(readCanonicalPath(data, "participants.birthDateRequired")),
    },
    transport: {
      mode: transportMode,
      allowPersonalCar: readBoolean(readCanonicalPath(data, "transport.allowPersonalCar")),
      transportCostAmount: readInteger(readCanonicalPath(data, "transport.transportCost")),
      dongAmount: readInteger(readCanonicalPath(data, "transport.dongAmount")),
    },
  };
}

export const DEFAULT_ADMIN_ASSISTED_REGISTRATION_FORM: AdminAssistedRegistrationFormState = {
  registrantMode: "member",
  memberUserId: "",
  memberDisplayName: "",
  guestLabel: "",
  guestPhone: "",
  guestEmail: "",
  partySize: "1",
  nationalId: "",
  fatherName: "",
  birthDate: "",
  paymentStatus: "unpaid",
  transportKind: "primary",
  personalCarOccupants: "",
  approveNow: false,
};

export const ADMIN_ASSISTED_REGISTRATION_STEPS: readonly AdminAssistedRegistrationStep[] = [
  "identity",
  "requirements",
  "logistics",
  "review",
] as const;

export function createDefaultAdminAssistedRegistrationForm(
  requirements: WorkspaceAdminRegistrationRequirements
): AdminAssistedRegistrationFormState {
  const transportChoices = resolveTransportChoices(requirements);
  return {
    ...DEFAULT_ADMIN_ASSISTED_REGISTRATION_FORM,
    transportKind: transportChoices[0] ?? "primary",
    approveNow: requirements.registrationApprovalMode === "auto",
  };
}

export function resolveTransportChoices(
  requirements: WorkspaceAdminRegistrationRequirements
): readonly WorkspaceRegistrationTransportKind[] {
  if (requirements.transport.mode === "shared_cars") {
    return ["personal_car", "no_car_dong", "no_car_acquaintance"];
  }
  if (requirements.transport.allowPersonalCar) {
    return ["primary", "personal_car", "no_car_dong", "no_car_acquaintance"];
  }
  return ["primary"];
}

export function stepHasVisibleRequirements(
  requirements: WorkspaceAdminRegistrationRequirements
): boolean {
  return (
    requirements.participantRequirements.nationalIdRequired ||
    requirements.participantRequirements.fatherNameRequired ||
    requirements.participantRequirements.birthDateRequired
  );
}

export function formatAdminAssistedMoneyLabel(
  amount: number | null,
  currency: string = "IRR"
): string | null {
  if (amount === null) {
    return null;
  }
  return new Intl.NumberFormat("fa-IR").format(amount) + ` ${currency}`;
}

export function validateAdminAssistedRegistrationStep(input: {
  readonly step: AdminAssistedRegistrationStep;
  readonly form: AdminAssistedRegistrationFormState;
  readonly requirements: WorkspaceAdminRegistrationRequirements;
}): AdminAssistedRegistrationValidationResult {
  const { form, requirements, step } = input;
  if (step === "identity") {
    if (form.registrantMode === "member") {
      if (form.memberUserId.trim().length === 0) {
        return { ok: false, field: "memberUserId", message: "MEMBER_REQUIRED" };
      }
    } else {
      if (form.guestLabel.trim().length === 0) {
        return { ok: false, field: "guestLabel", message: "GUEST_REQUIRED" };
      }
      if (form.guestPhone.trim().length < 8) {
        return { ok: false, field: "guestPhone", message: "PHONE_REQUIRED" };
      }
    }
    const partySize = Number(form.partySize);
    if (!Number.isFinite(partySize) || partySize <= 0) {
      return { ok: false, field: "partySize", message: "PARTY_SIZE_INVALID" };
    }
    if (requirements.capacityMax !== null && partySize > requirements.capacityMax) {
      return { ok: false, field: "partySize", message: "PARTY_SIZE_OVER_CAPACITY" };
    }
    return { ok: true };
  }

  if (step === "requirements") {
    if (
      requirements.participantRequirements.nationalIdRequired &&
      !/^\d{10}$/.test(form.nationalId.trim())
    ) {
      return { ok: false, field: "nationalId", message: "NATIONAL_ID_REQUIRED" };
    }
    if (
      requirements.participantRequirements.fatherNameRequired &&
      form.fatherName.trim().length === 0
    ) {
      return { ok: false, field: "fatherName", message: "FATHER_NAME_REQUIRED" };
    }
    if (
      requirements.participantRequirements.birthDateRequired &&
      !/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate.trim())
    ) {
      return { ok: false, field: "birthDate", message: "BIRTH_DATE_REQUIRED" };
    }
    return { ok: true };
  }

  if (step === "logistics") {
    if (
      form.transportKind === "personal_car" &&
      !["1", "2", "3"].includes(form.personalCarOccupants)
    ) {
      return {
        ok: false,
        field: "personalCarOccupants",
        message: "PERSONAL_CAR_OCCUPANTS_REQUIRED",
      };
    }
    return { ok: true };
  }

  return { ok: true };
}

export function buildAdminAssistedRegistrationPayload(input: {
  readonly tourId: string;
  readonly form: AdminAssistedRegistrationFormState;
  readonly requirements: WorkspaceAdminRegistrationRequirements;
}): AdminAssistedRegistrationCreatePayload {
  const partySize = Number(input.form.partySize);
  const transport =
    input.form.transportKind === "personal_car"
      ? {
          kind: "personal_car" as const,
          personalCarOccupants: Number(input.form.personalCarOccupants) as 1 | 2 | 3,
        }
      : { kind: input.form.transportKind };

  return {
    tourId: input.tourId,
    tourTitle: input.requirements.title,
    guestLabel:
      input.form.registrantMode === "member"
        ? input.form.memberDisplayName.trim()
        : input.form.guestLabel.trim(),
    guestPhone: input.form.guestPhone.trim(),
    ...(input.form.guestEmail.trim().length > 0 ? { guestEmail: input.form.guestEmail.trim() } : {}),
    ...(input.form.registrantMode === "member" && input.form.memberUserId.trim().length > 0
      ? { memberUserId: input.form.memberUserId.trim() }
      : {}),
    partySize,
    departureAt:
      input.requirements.departureAt ??
      new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00.000Z`).toISOString(),
    paymentStatus: input.form.paymentStatus,
    registrationIntake: {
      registrantTarget: input.form.registrantMode === "member" ? "self" : "other",
      transport,
      ...(input.form.nationalId.trim().length > 0
        ? { nationalId: input.form.nationalId.trim() }
        : {}),
      ...(input.requirements.capacityMax !== null
        ? { tourCapacityMax: input.requirements.capacityMax }
        : {}),
    },
  };
}
