import type {
  CatalogRegistrationPortalPayload,
  CatalogRegistrationUpstreamRequest,
} from "../../src/catalog/build-catalog-registration-upstream-request";
import type { IntakeSchema, IntakeSchemaContext } from "../../src/catalog/intake-schema";
import type { WorkspaceCatalogIntakeSurface } from "../../src/catalog/workspace-catalog-intake-surface";

const DENALI_SCHEMA: IntakeSchema = {
  fields: [
    {
      id: "fullName",
      type: "text",
      required: true,
      labelKey: "fields.fullName",
    },
    {
      id: "phone",
      type: "text",
      required: false,
      labelKey: "fields.phone",
    },
    {
      id: "nationalId",
      type: "text",
      required: true,
      labelKey: "fields.nationalId",
      rules: { pattern: "^[0-9]{10}$" },
    },
    {
      id: "fatherName",
      type: "text",
      required: true,
      labelKey: "fields.fatherName",
    },
    {
      id: "birthDate",
      type: "date",
      required: true,
      labelKey: "fields.birthDate",
    },
  ],
  features: {
    registrantTargetTabs: true,
    transportIntake: true,
    notesAtIntake: false,
    idempotencyKey: true,
  },
};

const URBAN_SCHEMA: IntakeSchema = {
  fields: [
    {
      id: "fullName",
      type: "text",
      required: true,
      labelKey: "fields.fullName",
    },
    {
      id: "partySize",
      type: "number",
      required: true,
      labelKey: "fields.partySize",
    },
    {
      id: "email",
      type: "email",
      required: true,
      labelKey: "fields.email",
    },
    {
      id: "notes",
      type: "text",
      required: false,
      labelKey: "fields.notes",
    },
  ],
  features: {
    registrantTargetTabs: false,
    transportIntake: false,
    notesAtIntake: true,
    idempotencyKey: true,
    successDataAttributes: { "data-urban-registration-success": true },
  },
};

function cloneSchema(schema: IntakeSchema): IntakeSchema {
  return {
    fields: schema.fields.map((field) => ({
      ...field,
      ...(field.rules !== undefined ? { rules: { ...field.rules } } : {}),
    })),
    features: {
      ...schema.features,
      ...(schema.features.successDataAttributes !== undefined
        ? { successDataAttributes: { ...schema.features.successDataAttributes } }
        : {}),
    },
  };
}

function resolveDenaliEffectiveSchema(context: IntakeSchemaContext): IntakeSchema {
  const hidden = new Set<string>();
  if (context.registrantTarget === "self") {
    for (const fieldId of ["fullName", "nationalId", "fatherName", "birthDate"]) {
      if (context.session[fieldId as keyof IntakeSchemaContext["session"]]?.trim()) {
        hidden.add(fieldId);
      }
    }
  }

  const requirements = context.tourRequirements;
  if (requirements?.nationalIdRequired !== true) {
    hidden.add("nationalId");
  }
  if (requirements?.fatherNameRequired !== true) {
    hidden.add("fatherName");
  }
  if (requirements?.birthDateRequired !== true) {
    hidden.add("birthDate");
  }
  hidden.add("phone");

  return {
    ...cloneSchema(DENALI_SCHEMA),
    fields: DENALI_SCHEMA.fields.filter((field) => !hidden.has(field.id)),
  };
}

function resolveDenaliSubmitValues(input: {
  readonly context: IntakeSchemaContext;
  readonly formValues: Readonly<Record<string, string>>;
}): Readonly<Record<string, string>> {
  return {
    fullName: input.formValues.fullName || input.context.session.fullName || "",
    nationalId: input.formValues.nationalId || input.context.session.nationalId || "",
    fatherName: input.formValues.fatherName || input.context.session.fatherName || "",
    birthDate: input.formValues.birthDate || input.context.session.birthDate || "",
  };
}

function buildDenaliUpstreamRequest(
  payload: CatalogRegistrationPortalPayload,
  options?: { readonly idempotencyKey?: string }
): CatalogRegistrationUpstreamRequest {
  const idempotencyKey = options?.idempotencyKey ?? `portal-denali-reg-${payload.tourId}`;
  return {
    path: "/denali/registrations",
    body: {
      tourId: payload.tourId,
      registrantTarget: payload.registrantTarget ?? "self",
      participant: {
        fullName: payload.fullName,
        nationalId: payload.nationalId,
        fatherName: payload.fatherName,
        birthDate: payload.birthDate,
      },
      transport: payload.transport,
    },
    extraHeaders: { "Idempotency-Key": idempotencyKey },
  };
}

function buildUrbanUpstreamRequest(
  payload: CatalogRegistrationPortalPayload,
  options?: { readonly idempotencyKey?: string }
): CatalogRegistrationUpstreamRequest {
  if (payload.email.trim().length === 0) {
    throw new Error("EMAIL_REQUIRED");
  }
  return {
    path: "/urban/registrations",
    body: {
      tourId: payload.tourId,
      fullName: payload.fullName,
      partySize: payload.partySize,
      email: payload.email,
      notes: payload.notes,
    },
    extraHeaders: {
      "Idempotency-Key": options?.idempotencyKey ?? `portal-urban-reg-${payload.tourId}`,
    },
  };
}

export const denaliCatalogIntakeFixture: WorkspaceCatalogIntakeSurface = {
  registrationApiPath: "/denali/registrations",
  schema: () => cloneSchema(DENALI_SCHEMA),
  resolveEffectiveSchema: resolveDenaliEffectiveSchema,
  resolveSubmitValues: resolveDenaliSubmitValues,
  buildUpstreamRequest: buildDenaliUpstreamRequest,
};

export const urbanCatalogIntakeFixture: WorkspaceCatalogIntakeSurface = {
  registrationApiPath: "/urban/registrations",
  schema: () => cloneSchema(URBAN_SCHEMA),
  resolveEffectiveSchema: () => cloneSchema(URBAN_SCHEMA),
  resolveSubmitValues: (input) => input.formValues,
  buildUpstreamRequest: buildUrbanUpstreamRequest,
};
