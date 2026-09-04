import type { IncomingMessage, ServerResponse } from "node:http";

import type { Prisma } from "@prisma/client";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { handleHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { assertTicketingWorkspaceGate } from "./assert-ticketing-access";
import {
  createTicketSlaPolicy,
  findTicketSlaPolicyByCode,
  listTicketSlaPolicies,
  toTicketSlaPolicyHttp,
  updateTicketSlaPolicy,
} from "./ticket-sla.repository";

function assertAdminRole(auth: TenantAuthContext): void {
  if (auth.role !== "owner" && auth.role !== "admin") {
    throw new Error("FORBIDDEN_OPERATOR_ENDPOINT");
  }
}

function parsePolicyBody(raw: unknown): {
  name: string;
  workspaceType?: string | null;
  categoryCode?: string | null;
  priority?: string | null;
  queueId?: string | null;
  firstResponseMinutes: number;
  nextResponseMinutes: number;
  resolutionMinutes: number;
  businessHours?: Record<string, unknown>;
  escalationSteps?: readonly Record<string, unknown>[];
  warningThresholdPercent?: number;
  enabled?: boolean;
} {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("INVALID_SLA_POLICY_BODY");
  }
  const body = raw as Record<string, unknown>;
  return {
    name: String(body.name ?? ""),
    workspaceType: body.workspaceType === null ? null : String(body.workspaceType ?? "") || null,
    categoryCode: body.categoryCode === null ? null : String(body.categoryCode ?? "") || null,
    priority: body.priority === null ? null : String(body.priority ?? "") || null,
    queueId: body.queueId === null ? null : String(body.queueId ?? "") || null,
    firstResponseMinutes: Number(body.firstResponseMinutes),
    nextResponseMinutes: Number(body.nextResponseMinutes),
    resolutionMinutes: Number(body.resolutionMinutes),
    businessHours:
      body.businessHours !== null && typeof body.businessHours === "object"
        ? (body.businessHours as Record<string, unknown>)
        : undefined,
    escalationSteps: Array.isArray(body.escalationSteps)
      ? (body.escalationSteps as Record<string, unknown>[])
      : undefined,
    warningThresholdPercent:
      body.warningThresholdPercent === undefined ? undefined : Number(body.warningThresholdPercent),
    enabled: body.enabled === undefined ? undefined : Boolean(body.enabled),
  };
}

async function operatorHandler(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (auth: TenantAuthContext) => Promise<void>,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await assertTicketingWorkspaceGate(auth.tenantId);
    await runWithHttpRequestContext(req, auth, () => handler(auth), { rateLimit: "read" });
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleListTicketSlaPolicies(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const items = await listTicketSlaPolicies(auth.tenantId);
    sendJson(res, 200, { items: items.map(toTicketSlaPolicyHttp) });
  });
}

export async function handleCreateTicketSlaPolicy(
  req: IncomingMessage,
  res: ServerResponse,
  code: string,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    assertAdminRole(auth);
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = parsePolicyBody(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
    const created = await createTicketSlaPolicy(auth.tenantId, {
      code,
      name: body.name,
      workspaceType: body.workspaceType,
      categoryCode: body.categoryCode,
      priority: body.priority,
      queueId: body.queueId,
      firstResponseMinutes: body.firstResponseMinutes,
      nextResponseMinutes: body.nextResponseMinutes,
      resolutionMinutes: body.resolutionMinutes,
      businessHoursJson: (body.businessHours ?? {}) as Prisma.InputJsonValue,
      escalationStepsJson: (body.escalationSteps ?? []) as Prisma.InputJsonValue,
      warningThresholdPercent: body.warningThresholdPercent,
      enabled: body.enabled,
    });
    sendJson(res, 201, { policy: toTicketSlaPolicyHttp(created) });
  });
}

export async function handleGetTicketSlaPolicy(
  req: IncomingMessage,
  res: ServerResponse,
  code: string,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const policy = await findTicketSlaPolicyByCode(auth.tenantId, code);
    if (policy === null) {
      sendJson(res, 404, { ok: false, code: "SLA_POLICY_NOT_FOUND" });
      return;
    }
    sendJson(res, 200, { policy: toTicketSlaPolicyHttp(policy) });
  });
}

export async function handlePatchTicketSlaPolicy(
  req: IncomingMessage,
  res: ServerResponse,
  code: string,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    assertAdminRole(auth);
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
    const body = parsePolicyBody(raw);
    const rowVersion = Number(raw.rowVersion);
    const updated = await updateTicketSlaPolicy(auth.tenantId, code, {
      name: body.name,
      workspaceType: body.workspaceType,
      categoryCode: body.categoryCode,
      priority: body.priority,
      queueId: body.queueId,
      firstResponseMinutes: body.firstResponseMinutes,
      nextResponseMinutes: body.nextResponseMinutes,
      resolutionMinutes: body.resolutionMinutes,
      businessHoursJson: body.businessHours as Prisma.InputJsonValue | undefined,
      escalationStepsJson: body.escalationSteps as Prisma.InputJsonValue | undefined,
      warningThresholdPercent: body.warningThresholdPercent,
      enabled: body.enabled,
      rowVersion,
    });
    if (updated === null) {
      sendJson(res, 409, { ok: false, code: "ROW_VERSION_CONFLICT" });
      return;
    }
    sendJson(res, 200, { policy: toTicketSlaPolicyHttp(updated) });
  });
}
