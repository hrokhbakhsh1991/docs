/**
 * Operator resolve helper for portal ticketing Playwright smoke (dev bearer + Postgres API).
 */
import { randomUUID } from "node:crypto";

import type { APIRequestContext } from "@playwright/test";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000102";
const OPERATOR_WORKSPACE_ID = "ws-operator-smoke";
const API_BASE_URL = process.env.TOUR_OPS_API_URL?.trim() || "http://127.0.0.1:3001";

function encodeDevBearerToken(input: {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: "admin" | "owner" | "member";
  readonly workspaceId: string;
}): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = JSON.stringify({
    userId: input.userId,
    tenantId: input.tenantId,
    role: input.role,
    status: "ACTIVE",
    workspaceId: input.workspaceId,
    exp,
  });
  return `Bearer dev.${Buffer.from(payload).toString("base64url")}`;
}

export async function resolveTicketForSmoke(
  request: APIRequestContext,
  ticketId: string,
  rowVersion: number,
): Promise<void> {
  const authorization = encodeDevBearerToken({
    userId: OPERATOR_SMOKE_ADMIN_USER_ID,
    tenantId: OPERATOR_SMOKE_TENANT_ID,
    role: "admin",
    workspaceId: OPERATOR_WORKSPACE_ID,
  });
  const response = await request.patch(`${API_BASE_URL}/tickets/${ticketId}`, {
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
      host: "operator.localhost",
    },
    data: { status: "resolved", rowVersion },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`resolveTicketForSmoke failed (${response.status()}): ${body}`);
  }
}

export async function readMemberTicketRowVersion(
  request: APIRequestContext,
  ticketId: string,
): Promise<number> {
  const response = await request.get(`/api/me/tickets/${ticketId}`);
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`readMemberTicketRowVersion failed (${response.status()}): ${body}`);
  }
  const body = (await response.json()) as { detail?: { rowVersion?: number } };
  const rowVersion = body.detail?.rowVersion;
  if (typeof rowVersion !== "number") {
    throw new Error("readMemberTicketRowVersion: missing rowVersion");
  }
  return rowVersion;
}
