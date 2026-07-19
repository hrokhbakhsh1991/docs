import type { IncomingMessage, ServerResponse } from "node:http";

import { assertProvisioningDevelopmentOnly } from "../../internal/provisioning-guard";
import {
  assertOpsServiceJwt,
  readAuthorizationHeader,
} from "../../internal/verify-ops-service-jwt";
import { handleHttpError } from "../../middleware/error-interceptor";
import { parseJsonBody, readRequestBodyRaw, sendJson } from "../../http/json";
import { isProductionAuthMode } from "../../tenant-kernel/auth-env";
import { getOutboxReplayRun } from "../../outbox/outbox-replay-audit";
import {
  runOutboxProdReplay,
  type OutboxReplayMode,
} from "../../outbox/outbox-prod-replay";

/** Production ops scope for outbox replay (Phase 3.17). */
export const OPS_SCOPE_OUTBOX_REPLAY = "outbox:replay";

async function assertOutboxReplayAllowed(req: IncomingMessage): Promise<void> {
  if (isProductionAuthMode()) {
    await assertOpsServiceJwt(readAuthorizationHeader(req), OPS_SCOPE_OUTBOX_REPLAY);
    return;
  }
  assertProvisioningDevelopmentOnly();
}

function pathname(req: IncomingMessage): string {
  return new URL(req.url ?? "/", "http://127.0.0.1").pathname;
}

function parseOptionalDate(raw: unknown, field: string): Date | undefined {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  if (typeof raw !== "string") {
    throw new Error(`OUTBOX_REPLAY_BODY_INVALID:${field}`);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`OUTBOX_REPLAY_BODY_INVALID:${field}`);
  }
  return d;
}

function parseBulkBody(raw: unknown): {
  mode: OutboxReplayMode;
  dryRun: boolean;
  confirm?: boolean;
  confirmPhrase?: string;
  actorUserId?: string;
  tenantId?: string;
  outboxIds?: string[];
  workspaceType?: string;
  from?: Date;
  to?: Date;
  eventTypePrefix?: string;
} {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("OUTBOX_REPLAY_BODY_INVALID");
  }
  const body = raw as Record<string, unknown>;
  const modeRaw = typeof body.mode === "string" ? body.mode : "";
  const allowed: OutboxReplayMode[] = [
    "single",
    "batch",
    "tenant",
    "workspace",
    "date_range",
  ];
  if (!allowed.includes(modeRaw as OutboxReplayMode)) {
    throw new Error("OUTBOX_REPLAY_BODY_INVALID:mode");
  }
  const outboxIds = Array.isArray(body.outboxIds)
    ? body.outboxIds.filter((id): id is string => typeof id === "string")
    : undefined;
  return {
    mode: modeRaw as OutboxReplayMode,
    dryRun: body.dryRun !== false,
    confirm: body.confirm === true,
    confirmPhrase: typeof body.confirmPhrase === "string" ? body.confirmPhrase : undefined,
    actorUserId: typeof body.actorUserId === "string" ? body.actorUserId : undefined,
    tenantId: typeof body.tenantId === "string" ? body.tenantId.trim() : undefined,
    outboxIds,
    workspaceType:
      typeof body.workspaceType === "string" ? body.workspaceType.trim() : undefined,
    from: parseOptionalDate(body.from, "from"),
    to: parseOptionalDate(body.to, "to"),
    eventTypePrefix:
      typeof body.eventTypePrefix === "string" ? body.eventTypePrefix : undefined,
  };
}

/**
 * POST /internal/outbox/:id/replay — single-event (Phase 3.17 auth + dry-run/confirm).
 * POST /internal/outbox/replay — bulk modes.
 * GET /internal/outbox/replay/runs/:runId — audit.
 */
export async function handleReplayOutbox(
  req: IncomingMessage,
  res: ServerResponse,
  outboxId: string
): Promise<void> {
  try {
    await assertOutboxReplayAllowed(req);
    const raw = await readRequestBodyRaw(req);
    const body = parseJsonBody(raw) as Record<string, unknown>;
    const tenantId =
      typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    if (tenantId.length === 0) {
      throw new Error("OUTBOX_REPLAY_TENANT_ID_REQUIRED");
    }
    const result = await runOutboxProdReplay({
      mode: "single",
      tenantId,
      outboxId,
      dryRun: body.dryRun !== false,
      confirm: body.confirm === true,
      confirmPhrase:
        typeof body.confirmPhrase === "string" ? body.confirmPhrase : undefined,
      actorUserId: typeof body.actorUserId === "string" ? body.actorUserId : undefined,
    });
    sendJson(res, 200, result);
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleInternalOutboxReplay(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    await assertOutboxReplayAllowed(req);
    const method = req.method ?? "GET";
    const path = pathname(req);

    const runMatch = /^\/internal\/outbox\/replay\/runs\/([^/]+)$/.exec(path);
    if (method === "GET" && runMatch) {
      const run = await getOutboxReplayRun(runMatch[1]!);
      if (run === null) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      sendJson(res, 200, { run });
      return;
    }

    if (method === "POST" && path === "/internal/outbox/replay") {
      const raw = await readRequestBodyRaw(req);
      const body = parseBulkBody(parseJsonBody(raw));
      if (body.mode === "single") {
        throw new Error("OUTBOX_REPLAY_BODY_INVALID:use_path_for_single");
      }
      const result = await runOutboxProdReplay(body);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    handleHttpError(res, error);
  }
}
