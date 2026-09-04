/**
 * Ticketing HTTP request schemas — TKT-001 Phase 1.
 *
 * Naming: initial ticket text field is `body` (matches TKT-001 §10.2 POST /member/tickets).
 */
import { z } from "zod";

import {
  categoryCodeSchema,
  parseWithZod,
  rowVersionSchema,
  ticketBodySchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketSubjectSchema,
  uuidSchema,
} from "./ticketing-validation";

/** Member POST /member/tickets — no priority/status/assignee/tenant/role fields. */
export const memberCreateTicketInputSchema = z
  .object({
    categoryCode: categoryCodeSchema,
    subject: ticketSubjectSchema,
    body: ticketBodySchema,
    relatedTourId: uuidSchema.optional(),
    relatedRegistrationId: uuidSchema.optional(),
  })
  .strict();

export type MemberCreateTicketInput = z.infer<typeof memberCreateTicketInputSchema>;

/** Member POST /member/tickets/:id/messages — visibility set server-side to public. */
export const memberAddMessageInputSchema = z
  .object({
    body: ticketBodySchema,
  })
  .strict();

export type MemberAddMessageInput = z.infer<typeof memberAddMessageInputSchema>;

/** Member POST /member/tickets/:id/reopen — optional message body. */
export const memberReopenTicketInputSchema = z
  .object({
    body: ticketBodySchema.optional(),
  })
  .strict();

export type MemberReopenTicketInput = z.infer<typeof memberReopenTicketInputSchema>;

/** Operator POST /tickets/:id/replies — visibility public (server-side). */
export const operatorReplyInputSchema = z
  .object({
    body: ticketBodySchema,
  })
  .strict();

export type OperatorReplyInput = z.infer<typeof operatorReplyInputSchema>;

/** Operator POST /tickets/:id/internal-notes — visibility internal (server-side). */
export const operatorInternalNoteInputSchema = z
  .object({
    body: ticketBodySchema,
  })
  .strict();

export type OperatorInternalNoteInput = z.infer<typeof operatorInternalNoteInputSchema>;

export const ticketStatusUpdateInputSchema = z
  .object({
    status: ticketStatusSchema,
    rowVersion: rowVersionSchema,
  })
  .strict();

export type TicketStatusUpdateInput = z.infer<typeof ticketStatusUpdateInputSchema>;

export const ticketPriorityUpdateInputSchema = z
  .object({
    priority: ticketPrioritySchema,
    rowVersion: rowVersionSchema,
  })
  .strict();

export type TicketPriorityUpdateInput = z.infer<typeof ticketPriorityUpdateInputSchema>;

export const ticketAssignmentInputSchema = z
  .object({
    assigneeUserId: uuidSchema.nullable(),
    rowVersion: rowVersionSchema,
  })
  .strict();

export type TicketAssignmentInput = z.infer<typeof ticketAssignmentInputSchema>;

/** Operator PATCH /tickets/:id — combined partial update with required rowVersion. */
export const operatorTicketPatchInputSchema = z
  .object({
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
    assigneeUserId: uuidSchema.nullable().optional(),
    onHold: z.boolean().optional(),
    onHoldReason: z.string().max(500).nullable().optional(),
    rowVersion: rowVersionSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.status !== undefined ||
      value.priority !== undefined ||
      value.assigneeUserId !== undefined ||
      value.onHold !== undefined,
    { message: "at least one of status, priority, assigneeUserId, onHold is required" },
  );

export type OperatorTicketPatchInput = z.infer<typeof operatorTicketPatchInputSchema>;

const operationalCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/);

/** Operator POST /tickets/bulk — batch status, priority, assign, tags with per-ticket partial failure. */
export const operatorTicketBulkInputSchema = z
  .object({
    ticketIds: z.array(uuidSchema).min(1).max(100),
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
    assigneeUserId: uuidSchema.nullable().optional(),
    assigneeTeamCode: operationalCodeSchema.nullable().optional(),
    addTagCodes: z.array(operationalCodeSchema).max(20).optional(),
    removeTagCodes: z.array(operationalCodeSchema).max(20).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.status !== undefined ||
      value.priority !== undefined ||
      value.assigneeUserId !== undefined ||
      value.assigneeTeamCode !== undefined ||
      (value.addTagCodes !== undefined && value.addTagCodes.length > 0) ||
      (value.removeTagCodes !== undefined && value.removeTagCodes.length > 0),
    { message: "at least one bulk mutation field is required" },
  )
  .refine(
    (value) => !(value.assigneeUserId !== undefined && value.assigneeTeamCode !== undefined),
    { message: "assigneeUserId and assigneeTeamCode are mutually exclusive" },
  );

export type OperatorTicketBulkInput = z.infer<typeof operatorTicketBulkInputSchema>;

export function parseMemberCreateTicketInput(raw: unknown): MemberCreateTicketInput {
  return parseWithZod(memberCreateTicketInputSchema, raw, "memberCreateTicket");
}

export function parseMemberAddMessageInput(raw: unknown): MemberAddMessageInput {
  return parseWithZod(memberAddMessageInputSchema, raw, "memberAddMessage");
}

export function parseMemberReopenTicketInput(raw: unknown): MemberReopenTicketInput {
  return parseWithZod(memberReopenTicketInputSchema, raw, "memberReopenTicket");
}

export function parseOperatorReplyInput(raw: unknown): OperatorReplyInput {
  return parseWithZod(operatorReplyInputSchema, raw, "operatorReply");
}

export function parseOperatorInternalNoteInput(raw: unknown): OperatorInternalNoteInput {
  return parseWithZod(operatorInternalNoteInputSchema, raw, "operatorInternalNote");
}

export function parseTicketStatusUpdateInput(raw: unknown): TicketStatusUpdateInput {
  return parseWithZod(ticketStatusUpdateInputSchema, raw, "ticketStatusUpdate");
}

export function parseTicketPriorityUpdateInput(raw: unknown): TicketPriorityUpdateInput {
  return parseWithZod(ticketPriorityUpdateInputSchema, raw, "ticketPriorityUpdate");
}

export function parseTicketAssignmentInput(raw: unknown): TicketAssignmentInput {
  return parseWithZod(ticketAssignmentInputSchema, raw, "ticketAssignment");
}

export function parseOperatorTicketPatchInput(raw: unknown): OperatorTicketPatchInput {
  return parseWithZod(operatorTicketPatchInputSchema, raw, "operatorTicketPatch");
}

export function parseOperatorTicketBulkInput(raw: unknown): OperatorTicketBulkInput {
  return parseWithZod(operatorTicketBulkInputSchema, raw, "operatorTicketBulk");
}
