/**
 * Shared Zod primitives for Denali wizard domain schemas.
 * Imported by generated slice files and the composed base schema.
 */

import { z } from "zod";

import { DENALI_TOUR_KIND_VALUES, type DenaliTourKind } from "@repo/types";

export function optionalInt(minMessage?: string) {
  return z
    .union([z.number().int().min(0, minMessage), z.nan(), z.undefined(), z.null(), z.literal("")])
    .transform((v) => (v == null || Number.isNaN(v) || v === "" ? undefined : v))
    .optional();
}

export function optionalPositiveInt(min = 1, message?: string) {
  return z
    .union([z.number().int().min(min, message), z.nan(), z.undefined(), z.null(), z.literal("")])
    .transform((v) => (v == null || Number.isNaN(v) || v === "" ? undefined : v))
    .optional();
}

export function isParsableIsoDateTime(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !Number.isNaN(Date.parse(trimmed));
}

export const denaliTourKindSchema = z.enum(
  DENALI_TOUR_KIND_VALUES as unknown as [DenaliTourKind, ...DenaliTourKind[]],
);

export const denaliTransportModeSchema = z.enum([
  "organizer_vehicle",
  "bus",
  "minibus",
  "train",
  "shared_cars",
  "none",
]);

export function rejectZeroAmount(
  value: unknown,
  ctx: z.RefinementCtx,
  path: (string | number)[],
  message: string,
): void {
  if (value === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  }
}
