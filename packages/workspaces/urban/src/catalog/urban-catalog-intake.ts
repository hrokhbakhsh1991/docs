import {
  CatalogRegistrationPayloadInvalidError,
  type CatalogRegistrationPortalPayload,
  type CatalogRegistrationUpstreamRequest,
  type IntakeSchema,
  type IntakeSchemaContext,
  type WorkspaceCatalogIntakeSurface,
} from "@app-tour/workspace-sdk";

const URBAN_REGISTRATION_API_PATH = "/urban/registrations";

const URBAN_CATALOG_INTAKE_SCHEMA: IntakeSchema = Object.freeze({
  fields: Object.freeze([
    Object.freeze({
      id: "fullName",
      type: "text",
      required: true,
      labelKey: "intake.nameLabel",
    }),
    Object.freeze({
      id: "partySize",
      type: "number",
      required: true,
      labelKey: "intake.partySizeLabel",
      widget: "localized-digits",
    }),
    Object.freeze({
      id: "email",
      type: "email",
      required: true,
      labelKey: "intake.emailLabel",
    }),
    Object.freeze({
      id: "notes",
      type: "text",
      required: false,
      labelKey: "intake.notesLabel",
    }),
  ]),
  features: Object.freeze({
    registrantTargetTabs: false,
    transportIntake: false,
    notesAtIntake: true,
    idempotencyKey: true,
    successDataAttributes: Object.freeze({ "data-urban-registration-success": true }),
  }),
});

function resolveUrbanEffectiveSchema(_context: IntakeSchemaContext): IntakeSchema {
  return URBAN_CATALOG_INTAKE_SCHEMA;
}

function resolveUrbanSubmitValues(input: {
  readonly context: IntakeSchemaContext;
  readonly formValues: Readonly<Record<string, string>>;
}): Readonly<Record<string, string>> {
  const merged: Record<string, string> = {};
  for (const field of URBAN_CATALOG_INTAKE_SCHEMA.fields) {
    merged[field.id] = input.formValues[field.id]?.trim() ?? "";
  }
  return Object.freeze(merged);
}

function buildUrbanEmailV1(
  payload: CatalogRegistrationPortalPayload,
  idempotencyKey: string
): CatalogRegistrationUpstreamRequest {
  const { tourId, fullName, email, phone, partySize, notes } = payload;
  if (email.trim().length === 0) {
    throw new CatalogRegistrationPayloadInvalidError("EMAIL_REQUIRED");
  }

  return {
    path: URBAN_REGISTRATION_API_PATH,
    body: {
      tourId,
      contact: {
        email: email.trim(),
        fullName,
        ...(phone.length > 0 ? { phone } : {}),
      },
      partySize,
      ...(notes.length > 0 ? { notes } : {}),
    },
    extraHeaders: Object.freeze({ "Idempotency-Key": idempotencyKey }),
  };
}

export const urbanCatalogIntakeSurface: WorkspaceCatalogIntakeSurface = Object.freeze({
  registrationApiPath: URBAN_REGISTRATION_API_PATH,
  schema: () => URBAN_CATALOG_INTAKE_SCHEMA,
  resolveEffectiveSchema: resolveUrbanEffectiveSchema,
  resolveSubmitValues: resolveUrbanSubmitValues,
  buildUpstreamRequest: (payload, options) => {
    const key =
      options?.idempotencyKey?.trim() ??
      `portal-urban-reg-${payload.tourId.trim()}-${Date.now()}`;
    return buildUrbanEmailV1(payload, key);
  },
});
