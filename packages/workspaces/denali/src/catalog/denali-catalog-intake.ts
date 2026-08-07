import { denaliCatalogTransportIntakeSurface } from "./denali-catalog-transport-intake";
import type {
  CatalogRegistrationPortalPayload,
  CatalogRegistrationUpstreamRequest,
  IntakeSchema,
  IntakeSchemaContext,
  IntakeSchemaTourRequirements,
  WorkspaceCatalogIntakeSurface,
} from "@app-tour/workspace-sdk";

const DENALI_REGISTRATION_API_PATH = "/denali/registrations";

const DENALI_CATALOG_INTAKE_SCHEMA: IntakeSchema = Object.freeze({
  fields: Object.freeze([
    Object.freeze({
      id: "fullName",
      type: "text",
      required: true,
      labelKey: "intake.nameLabel",
    }),
    Object.freeze({
      id: "nationalId",
      type: "text",
      required: true,
      labelKey: "intake.nationalIdLabel",
      rules: Object.freeze({ pattern: "^\\d{10}$" }),
      widget: "numeric-text",
    }),
    Object.freeze({
      id: "fatherName",
      type: "text",
      required: true,
      labelKey: "intake.fatherNameLabel",
    }),
    Object.freeze({
      id: "birthDate",
      type: "date",
      required: true,
      labelKey: "intake.birthDateLabel",
      rules: Object.freeze({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
    }),
  ]),
  features: Object.freeze({
    registrantTargetTabs: true,
    transportIntake: true,
    notesAtIntake: false,
    idempotencyKey: true,
  }),
});

function isKnownValue(value: string | undefined): boolean {
  return (value ?? "").trim().length > 0;
}

function shouldIncludeDenaliFieldForTour(
  fieldId: string,
  tourRequirements: IntakeSchemaTourRequirements | undefined
): boolean {
  switch (fieldId) {
    case "nationalId":
      return tourRequirements?.nationalIdRequired === true;
    case "fatherName":
      return tourRequirements?.fatherNameRequired === true;
    case "birthDate":
      return tourRequirements?.birthDateRequired === true;
    default:
      return true;
  }
}

function denaliTourApplicableFields(
  tourRequirements: IntakeSchemaTourRequirements | undefined
): readonly (typeof DENALI_CATALOG_INTAKE_SCHEMA.fields)[number][] {
  return DENALI_CATALOG_INTAKE_SCHEMA.fields.filter((field) =>
    shouldIncludeDenaliFieldForTour(field.id, tourRequirements)
  );
}

function shouldCollectDenaliIntakeField(fieldId: string, context: IntakeSchemaContext): boolean {
  if (context.registrantTarget === "other") {
    return true;
  }
  switch (fieldId) {
    case "fullName":
      return !isKnownValue(context.session.fullName);
    case "nationalId":
      return !isKnownValue(context.session.nationalId);
    case "fatherName":
      return !isKnownValue(context.session.fatherName);
    case "birthDate":
      return !isKnownValue(context.session.birthDate);
    case "email":
      return !isKnownValue(context.session.email);
    default:
      return true;
  }
}

function resolveDenaliEffectiveSchema(context: IntakeSchemaContext): IntakeSchema {
  const base = DENALI_CATALOG_INTAKE_SCHEMA;
  const tourApplicable = denaliTourApplicableFields(context.tourRequirements);
  const fields = tourApplicable.filter((field) => shouldCollectDenaliIntakeField(field.id, context));
  return Object.freeze({
    fields: Object.freeze(fields),
    features: base.features,
  });
}

function resolveDenaliSubmitValues(input: {
  readonly context: IntakeSchemaContext;
  readonly formValues: Readonly<Record<string, string>>;
}): Readonly<Record<string, string>> {
  const effective = resolveDenaliEffectiveSchema(input.context);
  const effectiveIds = new Set(effective.fields.map((field) => field.id));
  const merged: Record<string, string> = {};

  for (const field of denaliTourApplicableFields(input.context.tourRequirements)) {
    if (effectiveIds.has(field.id)) {
      merged[field.id] = input.formValues[field.id]?.trim() ?? "";
      continue;
    }
    const sessionValue = input.context.session[field.id as keyof IntakeSchemaContext["session"]];
    merged[field.id] = isKnownValue(sessionValue)
      ? sessionValue!.trim()
      : (input.formValues[field.id]?.trim() ?? "");
  }

  return Object.freeze(merged);
}

function buildDenaliContactV1(
  payload: CatalogRegistrationPortalPayload,
  idempotencyKey: string
): CatalogRegistrationUpstreamRequest {
  const {
    tourId,
    fullName,
    email,
    phone,
    partySize,
    nationalId,
    fatherName,
    birthDate,
    registrantTarget,
    transport,
  } = payload;

  return {
    path: DENALI_REGISTRATION_API_PATH,
    body: {
      tourId,
      ...(registrantTarget !== undefined ? { registrantTarget } : {}),
      contact: {
        fullName,
        ...(email.length > 0 ? { email } : {}),
        ...(phone.length > 0 ? { phone } : {}),
        ...(nationalId.length > 0 ? { nationalId } : {}),
        ...(fatherName.length > 0 ? { fatherName } : {}),
        ...(birthDate.length > 0 ? { birthDate } : {}),
      },
      partySize,
      ...(transport !== undefined && transport !== null ? { transport } : {}),
    },
    extraHeaders: Object.freeze({ "Idempotency-Key": idempotencyKey }),
  };
}

export const denaliCatalogIntakeSurface: WorkspaceCatalogIntakeSurface = Object.freeze({
  registrationApiPath: DENALI_REGISTRATION_API_PATH,
  schema: () => DENALI_CATALOG_INTAKE_SCHEMA,
  resolveEffectiveSchema: resolveDenaliEffectiveSchema,
  resolveSubmitValues: resolveDenaliSubmitValues,
  transport: denaliCatalogTransportIntakeSurface,
  buildUpstreamRequest: (payload, options) => {
    const key =
      options?.idempotencyKey?.trim() ||
      `portal-denali-reg-${payload.tourId.trim()}-${globalThis.crypto.randomUUID()}`;
    return buildDenaliContactV1(payload, key);
  },
});
