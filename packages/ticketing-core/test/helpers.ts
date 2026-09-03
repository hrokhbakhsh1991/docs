import type { Ticket, TicketActorContext } from "../src/domain/types";

export const TENANT_A = "00000000-0000-4000-8000-000000000010";
export const TENANT_B = "00000000-0000-4000-8000-000000000020";
export const MEMBER_A = "00000000-0000-4000-8000-000000000101";
export const MEMBER_B = "00000000-0000-4000-8000-000000000102";
export const ADMIN_A = "00000000-0000-4000-8000-000000000201";
export const OWNER_A = "00000000-0000-4000-8000-000000000301";
export const TICKET_ID = "00000000-0000-4000-8000-000000000401";
export const NOW = "2026-09-03T12:00:00.000Z";

export function actor(
  role: TicketActorContext["role"],
  overrides: Partial<TicketActorContext> = {},
): TicketActorContext {
  return {
    tenantId: TENANT_A,
    userId: role === "member" || role === "viewer" ? MEMBER_A : ADMIN_A,
    role,
    workspaceTicketingEnabled: true,
    tenantMemberUserIds: [MEMBER_A, MEMBER_B, ADMIN_A, OWNER_A],
    ...overrides,
  };
}

export function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: TICKET_ID,
    tenantId: TENANT_A,
    requesterUserId: MEMBER_A,
    assigneeUserId: null,
    categoryCode: "billing",
    subject: "Need help",
    priority: "normal",
    status: "open",
    relatedTourId: null,
    relatedRegistrationId: null,
    rowVersion: 1,
    lastActivityAt: NOW,
    resolvedAt: null,
    closedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}
