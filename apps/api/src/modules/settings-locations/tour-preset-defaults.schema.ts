/**
 * Backend contract for `workspace_tour_creation_presets.defaults` JSONB.
 *
 * Phase-1 scope (intentionally minimal — see prompt.md "Prompt 3-A"):
 *   - Enforce the first-level **type** of each known root key.
 *   - Reject **unknown root keys** so admins get a clear error instead of the
 *     silent drop performed by the wizard at apply-time
 *     (`apps/web/src/features/tours/wizard/tourCreationPresetMatch.ts`).
 *   - Leave the inside of each section (`overview`, `pricing`, ...) unrestricted
 *     via `.passthrough()` so wizard schema evolution does not break stored
 *     presets.
 *
 * Out of Phase 1 (handled later via `tour-preset-defaults-drift.ts`):
 *   - Deep validation of section contents.
 *   - `formProfile` ↔ `defaults.overview.mainTourThemeId` drift detection.
 *
 * Symmetry with web mapper: the root keys mirror `PATCH_SECTION_KEYS` in
 * `tourCreationPresetMatch.ts:33-46` (single source of truth for which roots
 * the wizard merges into the form).
 */
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

/** Wizard-known root keys consumed by `presetDefaultsToFormPatch` on the web. */
export const PRESET_DEFAULTS_ROOT_KEYS = [
  "autoAcceptRegistrations",
  "overview",
  "pricing",
  "schedule",
  "location",
  "itinerary",
  "participation",
  "logistics",
  "policies",
] as const;

export type PresetDefaultsRootKey = (typeof PRESET_DEFAULTS_ROOT_KEYS)[number];

const sectionShape = z.object({}).passthrough();

const presetDefaultsSchema = z
  .object({
    autoAcceptRegistrations: z.boolean().optional(),
    overview: sectionShape.optional(),
    pricing: sectionShape.optional(),
    schedule: sectionShape.optional(),
    location: sectionShape.optional(),
    itinerary: sectionShape.optional(),
    participation: sectionShape.optional(),
    logistics: sectionShape.optional(),
    policies: sectionShape.optional(),
  })
  .strict();

export type PresetDefaultsShape = z.infer<typeof presetDefaultsSchema>;

/**
 * Validates the structural shape of `preset.defaults` and returns the parsed
 * value. Throws a `BadRequestException` matching the existing service error
 * envelope (`{ error: { code, message, details? } }`) for the first failing
 * rule. The order of preference is:
 *
 *   1. `PRESET_DEFAULTS_UNKNOWN_ROOT` — unknown root keys (typo / drift).
 *   2. `PRESET_DEFAULTS_INVALID_TYPE` — wrong type at a known root key.
 *   3. `PRESET_DEFAULTS_INVALID`      — any other zod issue.
 */
export function parsePresetDefaultsOrThrow(
  value: Record<string, unknown>,
): PresetDefaultsShape {
  const result = presetDefaultsSchema.safeParse(value);
  if (result.success) return result.data;

  const issues = result.error.issues;
  const unknown = issues.find((i) => i.code === "unrecognized_keys") as
    | { code: "unrecognized_keys"; keys?: string[] }
    | undefined;
  if (unknown) {
    const unknownKeys = unknown.keys ?? [];
    throw new BadRequestException({
      error: {
        code: "PRESET_DEFAULTS_UNKNOWN_ROOT",
        message: `preset.defaults contains unknown root keys: ${unknownKeys.join(", ")}`,
        details: { unknownKeys, allowedKeys: [...PRESET_DEFAULTS_ROOT_KEYS] },
      },
    });
  }

  const invalidType = issues.find((i) => i.code === "invalid_type") as
    | { code: "invalid_type"; expected?: string; path: Array<string | number>; message: string }
    | undefined;
  if (invalidType) {
    const path = invalidType.path.join(".") || "<root>";
    const expected = invalidType.expected ?? "the expected type";
    const expectedDescription = expected === "object" ? "an object" : expected;
    throw new BadRequestException({
      error: {
        code: "PRESET_DEFAULTS_INVALID_TYPE",
        message: `preset.defaults.${path} must be ${expectedDescription}`,
        details: { path: invalidType.path, expected },
      },
    });
  }

  const fallback = issues[0]!;
  throw new BadRequestException({
    error: {
      code: "PRESET_DEFAULTS_INVALID",
      message: fallback.message,
      details: { path: fallback.path },
    },
  });
}
