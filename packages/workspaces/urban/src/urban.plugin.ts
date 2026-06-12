import { createPlatformWizardHostHooks } from "@app-tour/platform-core";
import {
  type WorkspacePlugin,
  type WorkspaceValidationHooks,
  type WorkspaceViolation,
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";

import {
  isUrbanTourPublished,
  toUrbanPublicCatalogCard,
} from "./catalog/urban-public-catalog-surface";

/** Relative to workspace package root — published via package exports. */
export const URBAN_THEME_TOKENS_STYLESHEET = "theme/tokens.css" as const;

export const URBAN_WORKSPACE_PLUGIN_ID = "urban" as const;
export const URBAN_WORKSPACE_TYPE = "urban" as const;

/** Canonical paths allowed in urban registry — mirrors URBAN-MINIMAL-SCOPE.md. */
export const URBAN_REGISTRY_CANONICAL_PATHS = [
  "tour.title",
  "tour.city",
  "tour.venueName",
  "tour.startDate",
  "tour.endDate",
  "tour.capacity",
  "tour.description",
  "tour.status",
  "tour.catalogSummary",
  "tour.coverImageUrl",
  "tour.publishStatus",
  "tour.publishedAt",
] as const;

export type UrbanRegistrationPayload = {
  readonly contact: {
    readonly email: string;
    readonly fullName: string;
    readonly phone?: string;
  };
  readonly partySize?: number;
  readonly notes?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COVER_URL_PATTERN = /^https?:\/\//;
const PHONE_PATTERN = /^[\d+\-().\s]*$/;

export function validateUrbanRegistrationPayload(
  payload: UrbanRegistrationPayload,
  context: { readonly capacity: number | null }
): void {
  const email = payload.contact.email.trim();
  if (email.length < 3 || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw new Error("URBAN_REGISTRATION_INVALID");
  }
  const fullName = payload.contact.fullName.trim();
  if (fullName.length < 1 || fullName.length > 200) {
    throw new Error("URBAN_REGISTRATION_INVALID");
  }
  if (payload.contact.phone !== undefined) {
    const phone = payload.contact.phone.trim();
    if (phone.length > 32 || !PHONE_PATTERN.test(phone)) {
      throw new Error("URBAN_REGISTRATION_INVALID");
    }
  }
  if (payload.partySize !== undefined) {
    if (!Number.isInteger(payload.partySize) || payload.partySize < 1) {
      throw new Error("URBAN_REGISTRATION_INVALID");
    }
    if (context.capacity !== null && payload.partySize > context.capacity) {
      throw new Error("URBAN_REGISTRATION_INVALID");
    }
  }
  if (payload.notes !== undefined && payload.notes.trim().length > 2000) {
    throw new Error("URBAN_REGISTRATION_INVALID");
  }
}

export function validateUrbanCatalogFieldValue(path: string, value: unknown): WorkspaceViolation | null {
  if (path === "tour.coverImageUrl" && typeof value === "string" && value.length > 0) {
    if (!COVER_URL_PATTERN.test(value)) {
      return { code: "URBAN_COVER_URL_INVALID", message: "tour.coverImageUrl must be http(s) URL" };
    }
  }
  if (path === "tour.catalogSummary" && typeof value === "string" && value.length > 500) {
    return { code: "URBAN_CATALOG_SUMMARY_TOO_LONG", message: "tour.catalogSummary max 500" };
  }
  return null;
}

export const URBAN_FORBIDDEN_CANONICAL_PREFIXES = [
  "tripDetails.itinerary.",
  "tripDetails.participation.",
  "transportModes",
] as const;

function deepFreezeValue<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreezeValue(child);
    }
  }
  return value;
}

export const URBAN_FIELD_REGISTRY = deepFreezeValue({
  version: 1,
  fields: [
    {
      id: "tour.title",
      canonicalPath: "tour.title",
      stepId: "tour",
      kind: "text" as const,
      required: true,
      tags: ["core"],
    },
    {
      id: "tour.city",
      canonicalPath: "tour.city",
      stepId: "tour",
      kind: "text" as const,
      required: true,
      tags: ["core"],
    },
    {
      id: "tour.venueName",
      canonicalPath: "tour.venueName",
      stepId: "tour",
      kind: "text" as const,
      required: true,
      tags: ["core"],
    },
    {
      id: "tour.startDate",
      canonicalPath: "tour.startDate",
      stepId: "tour",
      kind: "date" as const,
      required: true,
      tags: ["core"],
    },
    {
      id: "tour.endDate",
      canonicalPath: "tour.endDate",
      stepId: "tour",
      kind: "date" as const,
      required: true,
      tags: ["core"],
    },
    {
      id: "tour.capacity",
      canonicalPath: "tour.capacity",
      stepId: "tour",
      kind: "number" as const,
      required: true,
      tags: ["core"],
    },
    {
      id: "tour.description",
      canonicalPath: "tour.description",
      stepId: "tour",
      kind: "text" as const,
      required: false,
    },
    {
      id: "tour.status",
      canonicalPath: "tour.status",
      stepId: "tour",
      kind: "enum" as const,
      required: true,
      enumOptions: ["draft", "published"],
    },
    {
      id: "tour.catalogSummary",
      canonicalPath: "tour.catalogSummary",
      stepId: "tour",
      kind: "text" as const,
      required: false,
      tags: ["catalog"],
    },
    {
      id: "tour.coverImageUrl",
      canonicalPath: "tour.coverImageUrl",
      stepId: "tour",
      kind: "text" as const,
      required: false,
      tags: ["catalog"],
    },
    {
      id: "tour.publishStatus",
      canonicalPath: "tour.publishStatus",
      stepId: "tour",
      kind: "enum" as const,
      required: true,
      enumOptions: ["draft", "published", "archived"],
      tags: ["catalog"],
    },
    {
      id: "tour.publishedAt",
      canonicalPath: "tour.publishedAt",
      stepId: "tour",
      kind: "date" as const,
      required: false,
      tags: ["catalog"],
    },
  ],
});

export const URBAN_RULE_SET = deepFreezeValue({
  version: 1,
  matrixDimensions: ["tourType"],
  defaultCellId: "city",
  cells: [
    {
      cellId: "city",
      dimensions: { tourType: "city" },
      fieldOverrides: URBAN_FIELD_REGISTRY.fields.map((field) => ({
        fieldId: field.id,
        required: field.required,
        hidden: false,
      })),
    },
  ],
});

export const URBAN_WIZARD_SURFACE = deepFreezeValue({
  wizardMode: "classic" as const,
  railId: "urban_base",
  roots: ["tour"],
  inactiveFieldGroups: ["itinerary", "participation", "logistics"],
  wizardCapacityStepRedundant: false,
});

export const URBAN_LIFECYCLE = deepFreezeValue({
  initialStatus: "DRAFT",
  publishStatus: "PUBLISHED",
  allowedTransitions: [{ from: "DRAFT", to: "PUBLISHED" }],
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasForbiddenItineraryPayload(tripDetails: unknown): boolean {
  if (!isPlainObject(tripDetails)) {
    return false;
  }
  const itinerary = tripDetails.itinerary;
  if (!isPlainObject(itinerary)) {
    return false;
  }
  return "dayPlans" in itinerary || "segmentActivities" in itinerary;
}

function hasForbiddenParticipationPayload(tripDetails: unknown): boolean {
  if (!isPlainObject(tripDetails)) {
    return false;
  }
  return "participation" in tripDetails && tripDetails.participation != null;
}

export function createUrbanValidationHooks(): WorkspaceValidationHooks {
  return {
    checkCapacity(capacity: number): WorkspaceViolation | null {
      if (!Number.isFinite(capacity) || capacity < 1 || capacity > 50_000) {
        return {
          code: "URBAN_CAPACITY_OUT_OF_RANGE",
          message: "tour.capacity must be between 1 and 50000",
        };
      }
      return null;
    },
    checkTripDetails(
      tripDetails: unknown,
      transportModes?: readonly string[] | null
    ): WorkspaceViolation | null {
      if (transportModes != null && transportModes.length > 0) {
        return {
          code: "URBAN_FORBIDDEN_TRANSPORT",
          message: "transportModes are not allowed for urban workspace",
        };
      }
      if (hasForbiddenItineraryPayload(tripDetails)) {
        return {
          code: "URBAN_FORBIDDEN_ITINERARY",
          message: "tripDetails.itinerary is inactive for urban workspace",
        };
      }
      if (hasForbiddenParticipationPayload(tripDetails)) {
        return {
          code: "URBAN_FORBIDDEN_PARTICIPATION",
          message: "tripDetails.participation is inactive for urban workspace",
        };
      }
      return null;
    },
  };
}

const urbanWizardHostHooks = createPlatformWizardHostHooks({ dimensions: { tourType: "city" } });

const urbanTheme = {
  ...workspaceThemePresets["platform-primary"],
  optionalStylesheet: URBAN_THEME_TOKENS_STYLESHEET,
  cssVariables: {
    [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: "var(--color-primary)",
  },
} as const;

export function createUrbanWorkspacePlugin(): WorkspacePlugin {
  return deepFreezeValue({
    id: URBAN_WORKSPACE_PLUGIN_ID,
    version: 1,
    contractVersion: 1,
    supportedWorkspaceTypes: deepFreezeValue([URBAN_WORKSPACE_TYPE]),
    fieldRegistry: URBAN_FIELD_REGISTRY,
    ruleSet: URBAN_RULE_SET,
    wizard: URBAN_WIZARD_SURFACE,
    validation: createUrbanValidationHooks(),
    lifecycle: URBAN_LIFECYCLE,
    theme: deepFreezeValue({ ...urbanTheme }),
    publicCatalog: deepFreezeValue({
      isPublished: isUrbanTourPublished,
      toCatalogCard: toUrbanPublicCatalogCard,
    }),
    wizardHost: deepFreezeValue({ ...urbanWizardHostHooks }),
  });
}

export const urbanWorkspacePlugin = Object.freeze(createUrbanWorkspacePlugin()) as ReturnType<
  typeof createUrbanWorkspacePlugin
>;

export function getUrbanWorkspacePlugin(): typeof urbanWorkspacePlugin {
  return urbanWorkspacePlugin;
}
