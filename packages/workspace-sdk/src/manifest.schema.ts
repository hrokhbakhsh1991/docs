import { z } from "zod";

import { validateGuestCrossSurfaceNavLinks } from "./catalog/guest-cross-surface-nav.js";
import { assertThemeCssValueIsSafe } from "./theme/theme-css-value-safety.js";
import { normalizeThemeCssKey } from "./theme/normalize-theme-css-key.js";

/** Workspace plugin id — lowercase slug; must match the workspace directory name. */
export const WorkspaceManifestIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,31}$/, "id must be a lowercase slug (a-z, 0-9, hyphen)");

/** Guest cross-surface nav link `surface` discriminator. */
export const GuestCrossSurfaceNavSurfaceSchema = z.enum(["marketing", "portal_egress"]);

const MANIFEST_THEME_MAX_VARIABLES = 64;
const MANIFEST_THEME_MAX_VALUE_LENGTH = 4096;
const MANIFEST_THEME_CSS_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

const pluginEntrySchema = z.object({
  entry: z.string().min(1),
  export: z.string().min(1),
});

/** CW6-02 — platform profile catalog reference (expanded at codegen). */
export const WorkspaceProfileRefSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,63}$/, "profile must be a lowercase slug");

const workspaceModuleBindingSchema = z.object({
  module: z.string().min(1),
  export: z.string().min(1),
});

const workspaceEquipmentModuleBindingSchema = workspaceModuleBindingSchema;

const workspaceEquipmentEnricherBindingSchema = workspaceEquipmentModuleBindingSchema.extend({
  targetField: z.string().min(1),
  sourceField: z.string().min(1),
});

/** CW8-03 — manifest-declared workspace policy validator factory. */
export const WorkspacePolicyBlockSchema = workspaceModuleBindingSchema;

/** CW7-06 — transport capability block (top-level manifest extension). */
export const WorkspaceTransportBlockSchema = z.object({
  supported: z.boolean(),
  capabilities: z
    .object({
      wizardTourField: z.boolean().optional(),
      catalogSnapshot: z.boolean().optional(),
      catalogDetailSection: z.boolean().optional(),
      registrationIntake: z.boolean().optional(),
      registrationInitializer: z.boolean().optional(),
      listProjection: z.boolean().optional(),
      registrationNormalize: z.boolean().optional(),
    })
    .optional(),
  catalogSnapshotReader: workspaceModuleBindingSchema.optional(),
  registrationInitializer: workspaceModuleBindingSchema.optional(),
  catalogIntakeTransportSurface: workspaceModuleBindingSchema.optional(),
  registrationTransportNormalizer: workspaceModuleBindingSchema.optional(),
  fieldModule: workspaceModuleBindingSchema.optional(),
  wizardComposite: workspaceModuleBindingSchema.optional(),
});

/** CW7-09 — difficulty/fitness capability block (top-level manifest extension). */
export const WorkspaceDifficultyFitnessBlockSchema = z.object({
  supported: z.boolean(),
  capabilities: z
    .object({
      wizardTourField: z.boolean().optional(),
      catalogDetailSection: z.boolean().optional(),
      catalogListFilters: z.boolean().optional(),
      catalogMarketingFilters: z.boolean().optional(),
    })
    .optional(),
  fieldModule: workspaceModuleBindingSchema.optional(),
  filterPresentation: workspaceModuleBindingSchema.optional(),
});

/** CW7-11 — pricing capability block (top-level manifest extension). */
export const WorkspacePricingBlockSchema = z.object({
  supported: z.boolean(),
  capabilities: z
    .object({
      wizardTourField: z.boolean().optional(),
    })
    .optional(),
  fieldModule: workspaceModuleBindingSchema.optional(),
  wizardComposite: workspaceModuleBindingSchema.optional(),
});

/** CW7-10 — itinerary capability block (top-level manifest extension). */
export const WorkspaceItineraryBlockSchema = z.object({
  supported: z.boolean(),
  capabilities: z
    .object({
      wizardTourField: z.boolean().optional(),
      catalogDetailSection: z.boolean().optional(),
    })
    .optional(),
  fieldModule: workspaceModuleBindingSchema.optional(),
  wizardComposite: workspaceModuleBindingSchema.optional(),
});

/** CW7-02 — equipment capability block (top-level manifest extension). */
export const WorkspaceEquipmentBlockSchema = z.object({
  supported: z.boolean(),
  defaultModuleEnabledWhenUnset: z.boolean().optional(),
  capabilities: z
    .object({
      operatorSettings: z.boolean().optional(),
      wizardTourField: z.boolean().optional(),
      catalogDetailSection: z.boolean().optional(),
      guestLandingSection: z.boolean().optional(),
      registrationSnapshot: z.boolean().optional(),
    })
    .optional(),
  iconKeyValidator: workspaceEquipmentModuleBindingSchema.optional(),
  settingsEnricher: workspaceEquipmentEnricherBindingSchema.optional(),
  settingsEquipmentUi: workspaceEquipmentModuleBindingSchema.optional(),
  fieldModule: workspaceEquipmentModuleBindingSchema.optional(),
  wizardComposite: workspaceEquipmentModuleBindingSchema.optional(),
  themeFilter: workspaceEquipmentModuleBindingSchema.optional(),
});

const guestCrossSurfaceNavLinkSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,31}$/, "guestCrossSurfaceNav link id must be a lowercase slug"),
  labelKey: z.string().min(1),
  surface: GuestCrossSurfaceNavSurfaceSchema,
  path: z.string().optional(),
  egress: z.enum(["member_module", "marketing_home", "marketing_tours"]).optional(),
  memberModuleId: z.string().optional(),
  visibleWhen: z.enum(["always", "club", "platform_mother"]).optional(),
});

const guestCrossSurfaceNavSchema = z.object({
  version: z.literal(1),
  links: z.array(guestCrossSurfaceNavLinkSchema).max(8),
});

function validateManifestThemeCssKey(rawKey: string): string | undefined {
  const normalizedKey = normalizeThemeCssKey(rawKey);
  const bare = normalizedKey.startsWith("--") ? normalizedKey.slice(2) : normalizedKey;
  if (bare.length === 0 || !MANIFEST_THEME_CSS_NAME_PATTERN.test(bare)) {
    return undefined;
  }
  return normalizedKey;
}

/** Inline manifest `theme` block — CSS custom properties for PlatformThemeProvider. */
export const ManifestThemeBlockSchema = z
  .record(z.string().min(1), z.string())
  .superRefine((theme, ctx) => {
    const entries = Object.entries(theme);
    if (entries.length > MANIFEST_THEME_MAX_VARIABLES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `theme exceeds maximum variable count (${MANIFEST_THEME_MAX_VARIABLES})`,
      });
      return;
    }

    for (const [rawKey, rawValue] of entries) {
      const normalizedKey = validateManifestThemeCssKey(rawKey);
      if (normalizedKey === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [rawKey],
          message: `theme key "${rawKey}" is not a valid CSS custom property name`,
        });
        continue;
      }

      if (typeof rawValue !== "string") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [rawKey],
          message: "theme value must be a string",
        });
        continue;
      }

      const trimmed = rawValue.trim();
      if (trimmed.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [rawKey],
          message: "theme value must be non-empty",
        });
        continue;
      }

      if (trimmed.length > MANIFEST_THEME_MAX_VALUE_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [rawKey],
          message: `theme value exceeds maximum length (${MANIFEST_THEME_MAX_VALUE_LENGTH})`,
        });
        continue;
      }

      try {
        assertThemeCssValueIsSafe(rawKey, trimmed);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "theme value failed CSS safety checks";
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [rawKey],
          message,
        });
      }
    }
  });

/**
 * CI/production authority for `workspace.manifest.json`.
 * Strict on `id`, guest nav `surface`, and `theme`; extension blocks pass through.
 */
export const WorkspaceManifestCiSchema = z
  .object({
    id: WorkspaceManifestIdSchema,
    version: z.number().int().positive(),
    package: z.string().min(1),
    workspaceTypes: z.array(z.string().min(1)).min(1),
    plugin: pluginEntrySchema,
    profile: WorkspaceProfileRefSchema.optional(),
    workspaceEquipment: WorkspaceEquipmentBlockSchema.optional(),
    workspaceDifficultyFitness: WorkspaceDifficultyFitnessBlockSchema.optional(),
    workspaceItinerary: WorkspaceItineraryBlockSchema.optional(),
    workspacePricing: WorkspacePricingBlockSchema.optional(),
    workspaceTransport: WorkspaceTransportBlockSchema.optional(),
    workspacePolicy: WorkspacePolicyBlockSchema.optional(),
    theme: ManifestThemeBlockSchema.optional(),
    guestCrossSurfaceNav: guestCrossSurfaceNavSchema.optional(),
  })
  .passthrough();

export type WorkspaceManifestCiRecord = z.infer<typeof WorkspaceManifestCiSchema>;

export type WorkspaceManifestValidationResult =
  | { readonly ok: true; readonly manifest: WorkspaceManifestCiRecord }
  | { readonly ok: false; readonly errors: readonly string[] };

export function formatWorkspaceManifestZodIssues(
  issues: z.ZodIssue[],
  context: string,
): string[] {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${context}: ${path}: ${issue.message}`;
  });
}

/** Semantic checks beyond structural Zod (GCSN path/egress invariants). */
export function assertWorkspaceManifestSemantics(manifest: WorkspaceManifestCiRecord): void {
  if (manifest.guestCrossSurfaceNav !== undefined) {
    validateGuestCrossSurfaceNavLinks(manifest.guestCrossSurfaceNav.links);
  }
}

export function validateWorkspaceManifestRecord(
  raw: unknown,
  context: string,
): WorkspaceManifestValidationResult {
  const parsed = WorkspaceManifestCiSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: formatWorkspaceManifestZodIssues(parsed.error.issues, context),
    };
  }

  try {
    assertWorkspaceManifestSemantics(parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [`${context}: ${message}`] };
  }

  return { ok: true, manifest: parsed.data };
}

export function parseWorkspaceManifestForCi(raw: unknown, context: string): WorkspaceManifestCiRecord {
  const result = validateWorkspaceManifestRecord(raw, context);
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }
  return result.manifest;
}
