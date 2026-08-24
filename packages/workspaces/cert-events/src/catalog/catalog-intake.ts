import {
  CatalogRegistrationPayloadInvalidError,
  type CatalogRegistrationPortalPayload,
  type CatalogRegistrationUpstreamRequest,
  type IntakeSchema,
  type IntakeSchemaContext,
  type WorkspaceCatalogIntakeSurface,
} from "@app-tour/workspace-sdk";

const REGISTRATION_API_PATH = "/cert-events/registrations";

const INTAKE_SCHEMA: IntakeSchema = Object.freeze({
  fields: Object.freeze([
    Object.freeze({ id: "fullName", type: "text", required: true, labelKey: "intake.nameLabel" }),
    Object.freeze({ id: "email", type: "email", required: true, labelKey: "intake.emailLabel" }),
    Object.freeze({ id: "partySize", type: "number", required: true, labelKey: "intake.partySizeLabel" }),
    Object.freeze({ id: "notes", type: "text", required: false, labelKey: "intake.notesLabel" }),
  ]),
  features: Object.freeze({
    registrantTargetTabs: false,
    transportIntake: false,
    notesAtIntake: true,
    idempotencyKey: true,
    successDataAttributes: Object.freeze({ "data-cert-events-registration-success": true }),
  }),
});

function resolveEffectiveSchema(_context: IntakeSchemaContext): IntakeSchema {
  return INTAKE_SCHEMA;
}

function resolveSubmitValues(input: {
  readonly context: IntakeSchemaContext;
  readonly formValues: Readonly<Record<string, string>>;
}): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const field of INTAKE_SCHEMA.fields) {
    values[field.id] = input.formValues[field.id]?.trim() ?? "";
  }
  return Object.freeze(values);
}

function buildUpstreamRequest(
  payload: CatalogRegistrationPortalPayload,
  idempotencyKey: string
): CatalogRegistrationUpstreamRequest {
  if (payload.fullName.trim().length === 0) {
    throw new CatalogRegistrationPayloadInvalidError("FULL_NAME_REQUIRED");
  }
  if (payload.email.trim().length === 0) {
    throw new CatalogRegistrationPayloadInvalidError("EMAIL_REQUIRED");
  }
  return {
    path: REGISTRATION_API_PATH,
    body: {
      tourId: payload.tourId,
      contact: {
        fullName: payload.fullName.trim(),
        email: payload.email.trim(),
        ...(payload.phone.trim().length > 0 ? { phone: payload.phone.trim() } : {}),
      },
      partySize: payload.partySize,
      ...(payload.notes.trim().length > 0 ? { notes: payload.notes.trim() } : {}),
    },
    extraHeaders: Object.freeze({ "Idempotency-Key": idempotencyKey }),
  };
}

export const certEventsCatalogIntakeSurface: WorkspaceCatalogIntakeSurface = Object.freeze({
  registrationApiPath: REGISTRATION_API_PATH,
  schema: () => INTAKE_SCHEMA,
  resolveEffectiveSchema,
  resolveSubmitValues,
  buildUpstreamRequest: (payload, options) => {
    const key = options?.idempotencyKey?.trim() || "portal-cert-events-registration";
    return buildUpstreamRequest(payload, key);
  },
});
