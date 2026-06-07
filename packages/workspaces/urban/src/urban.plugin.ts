import {
  type WorkspacePlugin,
  type WorkspaceValidationHooks,
  type WorkspaceViolation,
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";

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
] as const;

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
  });
}

export const urbanWorkspacePlugin = Object.freeze(createUrbanWorkspacePlugin()) as ReturnType<
  typeof createUrbanWorkspacePlugin
>;

export function getUrbanWorkspacePlugin(): typeof urbanWorkspacePlugin {
  return urbanWorkspacePlugin;
}
