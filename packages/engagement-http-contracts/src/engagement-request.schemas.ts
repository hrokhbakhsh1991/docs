import { z } from "zod";

const uuidSchema = z.string().uuid();

const rowVersionSchema = z.number().int().positive();

const engagementCodeSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "code must be a lowercase slug");

const engagementI18nHttpTextSchema = z
  .object({
    en: z.string().trim().min(1).max(500),
    fa: z.string().trim().min(1).max(500),
  })
  .strict();

/** Duplicated from engagement-admin-catalog — contracts must not import apps/api. */
export const ENGAGEMENT_SUPPORTED_AWARD_EVENT_TYPES = Object.freeze([
  "profile.completed",
  "registration.first_approved",
] as const);

export const engagementSupportedAwardEventTypeSchema = z.enum(ENGAGEMENT_SUPPORTED_AWARD_EVENT_TYPES);

/** Duplicated from engagement-admin-catalog icon keys. */
export const ENGAGEMENT_BADGE_ICON_KEYS = Object.freeze([
  "mountain",
  "flag",
  "compass",
  "tent",
  "star",
  "medal",
  "summit",
  "trail",
] as const);

export const engagementBadgeIconKeySchema = z.enum(ENGAGEMENT_BADGE_ICON_KEYS);

const engagementTriggerKindSchema = z.enum(["event", "points_threshold"]);

const engagementDefinitionStatusSchema = z.enum(["active", "inactive", "archived"]);

const engagementDedupePolicySchema = z.enum(["per_user", "per_entity"]);

export const createBadgeBodySchema = z
  .object({
    code: engagementCodeSlugSchema,
    titleI18n: engagementI18nHttpTextSchema,
    descriptionI18n: engagementI18nHttpTextSchema,
    iconKey: engagementBadgeIconKeySchema,
    triggerKind: engagementTriggerKindSchema,
    triggerEventType: engagementSupportedAwardEventTypeSchema.optional(),
    triggerMinPoints: z.number().int().min(1).max(100_000).optional(),
    status: engagementDefinitionStatusSchema.optional(),
  })
  .strict();

export const updateBadgeBodySchema = z
  .object({
    rowVersion: rowVersionSchema,
    titleI18n: engagementI18nHttpTextSchema.optional(),
    descriptionI18n: engagementI18nHttpTextSchema.optional(),
    iconKey: engagementBadgeIconKeySchema.optional(),
    triggerKind: engagementTriggerKindSchema.optional(),
    triggerEventType: engagementSupportedAwardEventTypeSchema.nullable().optional(),
    triggerMinPoints: z.number().int().min(1).max(100_000).nullable().optional(),
    status: engagementDefinitionStatusSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.titleI18n !== undefined ||
      value.descriptionI18n !== undefined ||
      value.iconKey !== undefined ||
      value.triggerKind !== undefined ||
      value.triggerEventType !== undefined ||
      value.triggerMinPoints !== undefined ||
      value.status !== undefined,
    { message: "at least one mutable field is required" },
  );

export const createLevelBodySchema = z
  .object({
    code: engagementCodeSlugSchema,
    titleI18n: engagementI18nHttpTextSchema,
    descriptionI18n: engagementI18nHttpTextSchema,
    minPoints: z.number().int().min(0).max(1_000_000),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    status: engagementDefinitionStatusSchema.optional(),
  })
  .strict();

export const updateLevelBodySchema = z
  .object({
    rowVersion: rowVersionSchema,
    titleI18n: engagementI18nHttpTextSchema.optional(),
    descriptionI18n: engagementI18nHttpTextSchema.optional(),
    minPoints: z.number().int().min(0).max(1_000_000).optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    status: engagementDefinitionStatusSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.titleI18n !== undefined ||
      value.descriptionI18n !== undefined ||
      value.minPoints !== undefined ||
      value.sortOrder !== undefined ||
      value.status !== undefined,
    { message: "at least one mutable field is required" },
  );

export const createAwardRuleBodySchema = z
  .object({
    eventType: engagementSupportedAwardEventTypeSchema,
    points: z.number().int().min(1).max(10_000),
    badgeCode: engagementCodeSlugSchema.nullable().optional(),
    dedupePolicy: engagementDedupePolicySchema.optional(),
    status: engagementDefinitionStatusSchema.optional(),
  })
  .strict();

export const updateAwardRuleBodySchema = z
  .object({
    rowVersion: rowVersionSchema,
    points: z.number().int().min(1).max(10_000).optional(),
    badgeCode: engagementCodeSlugSchema.nullable().optional(),
    dedupePolicy: engagementDedupePolicySchema.optional(),
    status: engagementDefinitionStatusSchema.optional(),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.points !== undefined ||
      value.badgeCode !== undefined ||
      value.dedupePolicy !== undefined ||
      value.status !== undefined ||
      value.effectiveFrom !== undefined ||
      value.effectiveTo !== undefined,
    { message: "at least one mutable field is required" },
  );

export type CreateBadgeBody = z.infer<typeof createBadgeBodySchema>;
export type UpdateBadgeBody = z.infer<typeof updateBadgeBodySchema>;
export type CreateLevelBody = z.infer<typeof createLevelBodySchema>;
export type UpdateLevelBody = z.infer<typeof updateLevelBodySchema>;
export type CreateAwardRuleBody = z.infer<typeof createAwardRuleBodySchema>;
export type UpdateAwardRuleBody = z.infer<typeof updateAwardRuleBodySchema>;

export const operatorReversalBodySchema = z.object({
  originalEventId: uuidSchema,
  reason: z.string().trim().min(3).max(500),
});

export const operatorAdjustmentBodySchema = z.object({
  pointsDelta: z
    .number()
    .int()
    .refine((value) => value !== 0, { message: "pointsDelta must be non-zero" })
    .refine((value) => Math.abs(value) <= 500, { message: "pointsDelta out of range" }),
  reason: z.string().trim().min(3).max(500),
  sourceEntityId: uuidSchema.optional(),
});

export type OperatorReversalBody = z.infer<typeof operatorReversalBodySchema>;
export type OperatorAdjustmentBody = z.infer<typeof operatorAdjustmentBodySchema>;

export function parseCreateBadgeBody(body: unknown): CreateBadgeBody {
  return createBadgeBodySchema.parse(body);
}

export function parseUpdateBadgeBody(body: unknown): UpdateBadgeBody {
  return updateBadgeBodySchema.parse(body);
}

export function parseCreateLevelBody(body: unknown): CreateLevelBody {
  return createLevelBodySchema.parse(body);
}

export function parseUpdateLevelBody(body: unknown): UpdateLevelBody {
  return updateLevelBodySchema.parse(body);
}

export function parseCreateAwardRuleBody(body: unknown): CreateAwardRuleBody {
  return createAwardRuleBodySchema.parse(body);
}

export function parseUpdateAwardRuleBody(body: unknown): UpdateAwardRuleBody {
  return updateAwardRuleBodySchema.parse(body);
}

export function parseOperatorReversalBody(body: unknown): OperatorReversalBody {
  return operatorReversalBodySchema.parse(body);
}

export function parseOperatorAdjustmentBody(body: unknown): OperatorAdjustmentBody {
  return operatorAdjustmentBodySchema.parse(body);
}

export function parseEngagementListLimit(value: string | null): number {
  if (value === null || value.trim().length === 0) {
    return 20;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 20;
  }
  return Math.min(parsed, 100);
}

export function parseOptionalListCursor(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
