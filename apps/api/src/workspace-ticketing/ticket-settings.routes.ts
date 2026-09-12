import type { IncomingMessage, ServerResponse } from "node:http";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { handleHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { assertTicketingWorkspaceGate } from "./assert-ticketing-access";
import {
  getTicketWorkspaceSettings,
  updateTicketWorkspaceSettings,
} from "./ticket-settings.repository";

function assertAdminRole(auth: TenantAuthContext): void {
  if (auth.role !== "owner" && auth.role !== "admin") {
    throw new Error("FORBIDDEN_OPERATOR_ENDPOINT");
  }
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

export async function handleGetTicketSettings(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const settings = await getTicketWorkspaceSettings(auth.tenantId);
    if (settings === null) {
      sendJson(res, 404, { ok: false, code: "TICKET_MODULE_DISABLED" });
      return;
    }
    sendJson(res, 200, { settings });
  });
}

export async function handlePatchTicketSettings(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    assertAdminRole(auth);
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<
      string,
      unknown
    >;
    const rowVersion = Number(raw.rowVersion);
    const updated = await updateTicketWorkspaceSettings(auth.tenantId, {
      ...(raw.enabled !== undefined ? { enabled: Boolean(raw.enabled) } : {}),
      ...(Array.isArray(raw.allowedPriorities)
        ? { allowedPriorities: raw.allowedPriorities.filter((v) => typeof v === "string") }
        : {}),
      ...(raw.maxAttachmentSizeBytes !== undefined
        ? { maxAttachmentSizeBytes: Number(raw.maxAttachmentSizeBytes) }
        : {}),
      ...(raw.notificationPreferences !== null && typeof raw.notificationPreferences === "object"
        ? {
            notificationPreferences: raw.notificationPreferences as Record<string, unknown>,
          }
        : {}),
      ...(raw.slaDefaults !== null && typeof raw.slaDefaults === "object"
        ? { slaDefaults: raw.slaDefaults as Record<string, unknown> }
        : {}),
      ...(Array.isArray(raw.disabledCategoryCodes)
        ? {
            disabledCategoryCodes: raw.disabledCategoryCodes.filter((v) => typeof v === "string"),
          }
        : {}),
      rowVersion,
      updatedByUserId: auth.userId,
    });
    if (updated === null) {
      sendJson(res, 404, { ok: false, code: "TICKET_MODULE_DISABLED" });
      return;
    }
    sendJson(res, 200, { settings: updated });
  });
}
