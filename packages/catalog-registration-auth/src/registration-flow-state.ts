import {
  initialPublicRegistrationOtp,
  initialPublicRegistrationPhone,
} from "./public-registration-dev-defaults";

/** Mirrors workspace-sdk PublicCatalogTransportIntakeState (kept local to avoid SDK cycle). */
export type CatalogRegistrationTransportIntakeState = Readonly<{
  readonly optInPersonalCar: boolean;
  readonly hasPersonalCar: boolean | null;
  readonly personalCarOccupants: 1 | 2 | 3 | null;
  readonly paysDong: boolean | null;
}>;

export type CatalogRegistrationSavedSelfIntakeDefaults = Readonly<{
  readonly name: string;
  readonly nationalId: string;
  readonly fatherName: string;
  readonly birthDate: string;
}>;

/** Platform SSOT — every workspace registration flow uses this shape for FlowRuntimeState.data. */
export type CatalogRegistrationFlowState = Readonly<{
  readonly phone: string;
  readonly otp: string;
  readonly challengeId: string;
  readonly onboardingToken: string;
  readonly displayName: string;
  readonly profileEmail: string;
  readonly sessionEmail: string;
  readonly sessionNationalId: string;
  readonly sessionFatherName: string;
  readonly sessionBirthDate: string;
  readonly savedSelfIntakeDefaults: CatalogRegistrationSavedSelfIntakeDefaults;
  readonly intakeName: string;
  readonly intakeNationalId: string;
  readonly intakeFatherName: string;
  readonly intakeBirthDate: string;
  readonly intakeEmail: string;
  readonly partySize: string;
  readonly notes: string;
  readonly registrantTarget: "self" | "other";
  readonly transportState: CatalogRegistrationTransportIntakeState;
}>;

export class CatalogRegistrationFlowStateError extends Error {
  readonly code = "CATALOG_REGISTRATION_FLOW_STATE_INVALID" as const;

  constructor(message: string) {
    super(message);
    this.name = "CatalogRegistrationFlowStateError";
  }
}

export const CATALOG_REGISTRATION_FLOW_STATE_KEYS = [
  "phone",
  "otp",
  "challengeId",
  "onboardingToken",
  "displayName",
  "profileEmail",
  "sessionEmail",
  "sessionNationalId",
  "sessionFatherName",
  "sessionBirthDate",
  "savedSelfIntakeDefaults",
  "intakeName",
  "intakeNationalId",
  "intakeFatherName",
  "intakeBirthDate",
  "intakeEmail",
  "partySize",
  "notes",
  "registrantTarget",
  "transportState",
] as const satisfies readonly (keyof CatalogRegistrationFlowState)[];

function emptyTransportState(): CatalogRegistrationTransportIntakeState {
  return {
    optInPersonalCar: false,
    hasPersonalCar: null,
    personalCarOccupants: null,
    paysDong: null,
  };
}

/** Sole legal producer of empty registration flow data. */
export function createCatalogRegistrationFlowInitialData(): CatalogRegistrationFlowState {
  return Object.freeze({
    phone: initialPublicRegistrationPhone(),
    otp: initialPublicRegistrationOtp(),
    challengeId: "",
    onboardingToken: "",
    displayName: "",
    profileEmail: "",
    sessionEmail: "",
    sessionNationalId: "",
    sessionFatherName: "",
    sessionBirthDate: "",
    savedSelfIntakeDefaults: Object.freeze({
      name: "",
      nationalId: "",
      fatherName: "",
      birthDate: "",
    }),
    intakeName: "",
    intakeNationalId: "",
    intakeFatherName: "",
    intakeBirthDate: "",
    intakeEmail: "",
    partySize: "1",
    notes: "",
    registrantTarget: "self",
    transportState: emptyTransportState(),
  });
}

export function createCatalogRegistrationFlowRuntimeState(input: {
  readonly initialStep: string;
}): { readonly currentStep: string; readonly data: CatalogRegistrationFlowState } {
  return Object.freeze({
    currentStep: input.initialStep,
    data: createCatalogRegistrationFlowInitialData(),
  });
}

function isTransportState(value: unknown): value is CatalogRegistrationTransportIntakeState {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.optInPersonalCar === "boolean" &&
    (row.hasPersonalCar === null || typeof row.hasPersonalCar === "boolean") &&
    (row.personalCarOccupants === null ||
      row.personalCarOccupants === 1 ||
      row.personalCarOccupants === 2 ||
      row.personalCarOccupants === 3) &&
    (row.paysDong === null || typeof row.paysDong === "boolean")
  );
}

function isSavedDefaults(value: unknown): value is CatalogRegistrationSavedSelfIntakeDefaults {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === "string" &&
    typeof row.nationalId === "string" &&
    typeof row.fatherName === "string" &&
    typeof row.birthDate === "string"
  );
}

/** Fail-fast when workspace surface or reducer produces an invalid data bag. */
export function assertCatalogRegistrationFlowState(
  data: unknown,
  label = "registration flow state"
): asserts data is CatalogRegistrationFlowState {
  if (data === null || typeof data !== "object") {
    throw new CatalogRegistrationFlowStateError(`${label}: expected object`);
  }
  const record = data as Record<string, unknown>;
  for (const key of CATALOG_REGISTRATION_FLOW_STATE_KEYS) {
    if (!(key in record)) {
      throw new CatalogRegistrationFlowStateError(`${label}: missing key "${key}"`);
    }
  }
  for (const key of Object.keys(record)) {
    if (!CATALOG_REGISTRATION_FLOW_STATE_KEYS.includes(key as (typeof CATALOG_REGISTRATION_FLOW_STATE_KEYS)[number])) {
      throw new CatalogRegistrationFlowStateError(`${label}: unexpected key "${key}"`);
    }
  }
  const stringKeys = [
    "phone",
    "otp",
    "challengeId",
    "onboardingToken",
    "displayName",
    "profileEmail",
    "sessionEmail",
    "sessionNationalId",
    "sessionFatherName",
    "sessionBirthDate",
    "intakeName",
    "intakeNationalId",
    "intakeFatherName",
    "intakeBirthDate",
    "intakeEmail",
    "partySize",
    "notes",
  ] as const;
  for (const key of stringKeys) {
    if (typeof record[key] !== "string") {
      throw new CatalogRegistrationFlowStateError(`${label}: "${key}" must be string`);
    }
  }
  if (record.registrantTarget !== "self" && record.registrantTarget !== "other") {
    throw new CatalogRegistrationFlowStateError(`${label}: registrantTarget must be "self" | "other"`);
  }
  if (!isSavedDefaults(record.savedSelfIntakeDefaults)) {
    throw new CatalogRegistrationFlowStateError(`${label}: savedSelfIntakeDefaults invalid`);
  }
  if (!isTransportState(record.transportState)) {
    throw new CatalogRegistrationFlowStateError(`${label}: transportState invalid`);
  }
}

export function readCatalogRegistrationFlowState(
  data: Readonly<Record<string, unknown>>
): CatalogRegistrationFlowState {
  assertCatalogRegistrationFlowState(data);
  return data;
}
