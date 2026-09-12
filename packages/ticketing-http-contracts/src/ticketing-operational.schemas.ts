import { z } from "zod";

import {
  parseWithZod,
  rowVersionSchema,
  uuidSchema,
} from "./ticketing-validation";

const operationalCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/);

export const ticketTagCreateInputSchema = z
  .object({
    code: operationalCodeSchema,
    label: z.string().trim().min(1).max(120),
    colorToken: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type TicketTagCreateInput = z.infer<typeof ticketTagCreateInputSchema>;

export const ticketTagUpdateInputSchema = z
  .object({
    label: z.string().trim().min(1).max(120).optional(),
    colorToken: z.string().trim().min(1).max(64).nullable().optional(),
    archived: z.boolean().optional(),
    rowVersion: rowVersionSchema,
  })
  .strict()
  .refine((value) => value.label !== undefined || value.colorToken !== undefined || value.archived !== undefined, {
    message: "at least one of label, colorToken, archived is required",
  });

export type TicketTagUpdateInput = z.infer<typeof ticketTagUpdateInputSchema>;

export const ticketQueueCreateInputSchema = z
  .object({
    code: operationalCodeSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    filterJson: z.record(z.unknown()).optional(),
    teamCode: operationalCodeSchema.optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();

export type TicketQueueCreateInput = z.infer<typeof ticketQueueCreateInputSchema>;

export const ticketQueueUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    filterJson: z.record(z.unknown()).optional(),
    teamCode: operationalCodeSchema.nullable().optional(),
    isDefault: z.boolean().optional(),
    archived: z.boolean().optional(),
    rowVersion: rowVersionSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.enabled !== undefined ||
      value.sortOrder !== undefined ||
      value.filterJson !== undefined ||
      value.teamCode !== undefined ||
      value.isDefault !== undefined ||
      value.archived !== undefined,
    { message: "at least one mutable field is required" },
  );

export type TicketQueueUpdateInput = z.infer<typeof ticketQueueUpdateInputSchema>;

export const ticketTeamCreateInputSchema = z
  .object({
    code: operationalCodeSchema,
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    enabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    memberUserIds: z.array(uuidSchema).max(200).optional(),
  })
  .strict();

export type TicketTeamCreateInput = z.infer<typeof ticketTeamCreateInputSchema>;

export const ticketTeamUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    archived: z.boolean().optional(),
    memberUserIds: z.array(uuidSchema).max(200).optional(),
    rowVersion: rowVersionSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.enabled !== undefined ||
      value.isDefault !== undefined ||
      value.archived !== undefined ||
      value.memberUserIds !== undefined,
    { message: "at least one mutable field is required" },
  );

export type TicketTeamUpdateInput = z.infer<typeof ticketTeamUpdateInputSchema>;

export const ticketAssignInputSchema = z
  .object({
    assigneeUserId: uuidSchema.nullable().optional(),
    assigneeTeamCode: operationalCodeSchema.nullable().optional(),
    rowVersion: rowVersionSchema,
  })
  .strict()
  .refine(
    (value) => value.assigneeUserId !== undefined || value.assigneeTeamCode !== undefined,
    { message: "assigneeUserId or assigneeTeamCode is required" },
  )
  .refine(
    (value) => !(value.assigneeUserId && value.assigneeTeamCode),
    { message: "assigneeUserId and assigneeTeamCode are mutually exclusive" },
  );

export type TicketAssignInput = z.infer<typeof ticketAssignInputSchema>;

export const ticketQueueChangeInputSchema = z
  .object({
    queueCode: operationalCodeSchema.nullable(),
    rowVersion: rowVersionSchema,
  })
  .strict();

export type TicketQueueChangeInput = z.infer<typeof ticketQueueChangeInputSchema>;

export const ticketTagMutationInputSchema = z
  .object({
    tagCode: operationalCodeSchema,
    rowVersion: rowVersionSchema,
  })
  .strict();

export type TicketTagMutationInput = z.infer<typeof ticketTagMutationInputSchema>;

export function parseTicketTagCreateInput(raw: unknown): TicketTagCreateInput {
  return parseWithZod(ticketTagCreateInputSchema, raw, "ticketTagCreate");
}

export function parseTicketTagUpdateInput(raw: unknown): TicketTagUpdateInput {
  return parseWithZod(ticketTagUpdateInputSchema, raw, "ticketTagUpdate");
}

export function parseTicketQueueCreateInput(raw: unknown): TicketQueueCreateInput {
  return parseWithZod(ticketQueueCreateInputSchema, raw, "ticketQueueCreate");
}

export function parseTicketQueueUpdateInput(raw: unknown): TicketQueueUpdateInput {
  return parseWithZod(ticketQueueUpdateInputSchema, raw, "ticketQueueUpdate");
}

export function parseTicketTeamCreateInput(raw: unknown): TicketTeamCreateInput {
  return parseWithZod(ticketTeamCreateInputSchema, raw, "ticketTeamCreate");
}

export function parseTicketTeamUpdateInput(raw: unknown): TicketTeamUpdateInput {
  return parseWithZod(ticketTeamUpdateInputSchema, raw, "ticketTeamUpdate");
}

export function parseTicketAssignInput(raw: unknown): TicketAssignInput {
  return parseWithZod(ticketAssignInputSchema, raw, "ticketAssign");
}

export function parseTicketQueueChangeInput(raw: unknown): TicketQueueChangeInput {
  return parseWithZod(ticketQueueChangeInputSchema, raw, "ticketQueueChange");
}

export function parseTicketTagMutationInput(raw: unknown): TicketTagMutationInput {
  return parseWithZod(ticketTagMutationInputSchema, raw, "ticketTagMutation");
}
