/**
 * Ticketing business-entity link HTTP contracts — TKT-001 Phase E1.
 */
import { z } from "zod";

import { uuidSchema, parseWithZod } from "./ticketing-validation";

export const TICKET_LINK_ENTITY_TYPES = [
  "tour",
  "registration",
  "payment",
  "wallet",
] as const;

export const ticketLinkEntityTypeSchema = z.enum(TICKET_LINK_ENTITY_TYPES);

export const ticketLinkCreateInputSchema = z
  .object({
    entityType: ticketLinkEntityTypeSchema,
    entityId: uuidSchema,
  })
  .strict();

export type TicketLinkCreateInput = z.infer<typeof ticketLinkCreateInputSchema>;

export type TicketLinkHttp = {
  readonly id: string;
  readonly ticketId: string;
  readonly entityType: (typeof TICKET_LINK_ENTITY_TYPES)[number];
  readonly entityId: string;
  readonly createdAt: string;
};

export type TicketLinkListHttpResponse = {
  readonly items: readonly TicketLinkHttp[];
};

export function parseTicketLinkCreateInput(raw: unknown): TicketLinkCreateInput {
  return parseWithZod(ticketLinkCreateInputSchema, raw, "ticket link");
}
