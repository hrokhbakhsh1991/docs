import type { IncomingMessage, ServerResponse } from "node:http";

import { assertProvisioningDevelopmentOnly } from "../../internal/provisioning-guard";
import {
  assertOpsServiceJwt,
  OPS_SCOPE_METRICS_READ,
  readAuthorizationHeader,
} from "../../internal/verify-ops-service-jwt";
import { handleHttpError } from "../../middleware/error-interceptor";
import { parseJsonBody, readRequestBodyRaw, sendJson } from "../../http/json";
import { isProductionAuthMode } from "../../tenant-kernel/auth-env";
import type { FinanceReconJobId } from "../../workspace-finance/recon/codes";
import { runFinanceReconJob } from "../../workspace-finance/recon/finance-recon-runner";
import {
  getFinanceReconFinding,
  listOpenFinanceReconFindings,
} from "../../workspace-finance/recon/findings-store";
import {
  listFinanceReconRepairMatrix,
  runFinanceReconRepairEngine,
  type FinanceReconRepairEngineInput,
} from "../../workspace-finance/recon/repair-engine";
import type { FinanceReconRepairMode } from "../../workspace-finance/recon/repair-matrix";

/** Reuse metrics:read scope for recon ops (same scrape identity). */
export const OPS_SCOPE_FINANCE_RECON = OPS_SCOPE_METRICS_READ;

async function assertFinanceReconAllowed(req: IncomingMessage): Promise<void> {
  if (isProductionAuthMode()) {
    await assertOpsServiceJwt(readAuthorizationHeader(req), OPS_SCOPE_FINANCE_RECON);
    return;
  }
  assertProvisioningDevelopmentOnly();
}

function pathname(req: IncomingMessage): string {
  return new URL(req.url ?? "/", "http://127.0.0.1").pathname;
}

function parseRepairMode(raw: unknown, dryRun: boolean): FinanceReconRepairMode | undefined {
  if (typeof raw === "string") {
    const mode = raw.trim().toLowerCase();
    if (
      mode === "preview" ||
      mode === "manual" ||
      mode === "approved" ||
      mode === "automatic"
    ) {
      return mode;
    }
  }
  return dryRun ? "preview" : "manual";
}

export async function handleInternalFinanceRecon(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    await assertFinanceReconAllowed(req);
    const method = req.method ?? "GET";
    const path = pathname(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (method === "GET" && path === "/internal/finance/recon/repair-matrix") {
      sendJson(res, 200, { matrix: listFinanceReconRepairMatrix() });
      return;
    }

    if (method === "GET" && path === "/internal/finance/recon/findings") {
      const rows = await listOpenFinanceReconFindings({
        tenantId: url.searchParams.get("tenantId")?.trim() || undefined,
        code: url.searchParams.get("code")?.trim() || undefined,
        limit: Number.parseInt(url.searchParams.get("limit") ?? "100", 10) || 100,
      });
      sendJson(res, 200, { findings: rows });
      return;
    }

    const findingMatch = /^\/internal\/finance\/recon\/findings\/([^/]+)$/.exec(path);
    if (method === "GET" && findingMatch) {
      const finding = await getFinanceReconFinding(findingMatch[1]!);
      if (finding === null) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      sendJson(res, 200, { finding });
      return;
    }

    const repairMatch = /^\/internal\/finance\/recon\/findings\/([^/]+)\/repair$/.exec(path);
    if (method === "POST" && repairMatch) {
      const raw = await readRequestBodyRaw(req);
      const body = parseJsonBody(raw) as {
        dryRun?: unknown;
        mode?: unknown;
        reason?: unknown;
        action?: unknown;
        actorUserId?: unknown;
        approvedConfirm?: unknown;
      };
      const legacyDryRun = body.dryRun !== false;
      const mode = parseRepairMode(body.mode, legacyDryRun);
      const action = body.action === "ignore" ? "ignore" : "repair";
      const input: FinanceReconRepairEngineInput = {
        findingId: repairMatch[1]!,
        mode,
        dryRun: mode === "preview",
        action,
        actorUserId:
          typeof body.actorUserId === "string" ? body.actorUserId : undefined,
        reason: typeof body.reason === "string" ? body.reason : undefined,
        approvedConfirm: body.approvedConfirm === true,
      };
      const result = await runFinanceReconRepairEngine(input);
      const status =
        result.result === "error" || result.result === "rejected" ? 400 : 200;
      sendJson(res, status, result);
      return;
    }

    if (method === "POST" && path === "/internal/finance/recon/run") {
      const raw = await readRequestBodyRaw(req);
      const body = parseJsonBody(raw) as { job?: unknown; tenantId?: unknown };
      const jobRaw = typeof body.job === "string" ? body.job.toUpperCase() : "ALL";
      const allowed: FinanceReconJobId[] = ["R1", "R2", "R3", "R4", "R5", "R6", "ALL"];
      const job = (allowed.includes(jobRaw as FinanceReconJobId)
        ? jobRaw
        : "ALL") as FinanceReconJobId;
      const result = await runFinanceReconJob({
        job,
        tenantId: typeof body.tenantId === "string" ? body.tenantId : undefined,
      });
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    handleHttpError(res, error);
  }
}
