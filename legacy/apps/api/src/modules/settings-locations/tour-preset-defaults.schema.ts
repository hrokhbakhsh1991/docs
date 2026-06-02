import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

import { getTourWorkspaceDefinition } from "@repo/shared-contracts";
import { normalizeTourFormProfileInput, type TourFormProfile } from "@repo/types";

/** Classic wizard roots — symmetry with `presetDefaultsToFormPatch` on web. */
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

const classicPresetDefaultsSchema = z
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

export type PresetDefaultsShape = z.infer<typeof classicPresetDefaultsSchema>;

export type ParsePresetDefaultsOptions = {
  formProfile?: TourFormProfile | string | null;
};

function throwPresetValidationError(
  result: z.ZodSafeParseError<unknown>,
  allowedRoots: readonly string[],
): never {
  const issues = result.error.issues;
  const unknownIssue = issues.find((i) => i.code === z.ZodIssueCode.unrecognized_keys);
  
  if (unknownIssue && unknownIssue.code === z.ZodIssueCode.unrecognized_keys) {
    throw new BadRequestException({
      error: {
        code: "PRESET_DEFAULTS_UNKNOWN_ROOT",
        message: `Invalid preset defaults: unknown root keys: ${unknownIssue.keys.join(", ")}. Allowed: ${allowedRoots.join(", ")}`,
        details: { unknownKeys: unknownIssue.keys, allowedKeys: allowedRoots },
      },
    });
  }

  const issue = issues[0];
  const path = issue?.path?.join(".") ?? "<root>";
  const expected = issue?.code === z.ZodIssueCode.invalid_type ? issue.expected : "the correct type";
  const messageExpected = expected === "object" ? "an object" : expected;

  throw new BadRequestException({
    error: {
      code: "PRESET_DEFAULTS_INVALID_TYPE",
      message: `Invalid preset defaults: preset.defaults.${path} must be ${messageExpected}.`,
      details: { path: issue.path },
    },
  });
}

function buildWorkspacePresetSchema(roots: readonly string[]): z.ZodObject<any> {
  const shape = Object.fromEntries(roots.map((root) => [root, sectionShape.optional()]));
  return z.object(shape).strip();
}

/**
 * Validates `preset.defaults` for the given form profile.
 */
export function parsePresetDefaultsOrThrow(
  value: Record<string, unknown>,
  options: ParsePresetDefaultsOptions = {},
): PresetDefaultsShape | Record<string, unknown> {
  const profile = normalizeTourFormProfileInput(options.formProfile ?? "general");
  const workspace = getTourWorkspaceDefinition(profile);

  if (workspace) {
    const schema = buildWorkspacePresetSchema(workspace.roots);
    const result = schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    throwPresetValidationError(result, workspace.roots);
  }

  const result = classicPresetDefaultsSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throwPresetValidationError(result, PRESET_DEFAULTS_ROOT_KEYS);
}
