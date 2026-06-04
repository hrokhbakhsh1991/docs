import type { IncomingMessage, ServerResponse } from "node:http";

import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseWorkspaceTenantLabelFromHost,
} from "@app-tour/tenant-kernel";

import { sendJson } from "../http/json";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { findTenantById, findTenantBySubdomain } from "./tenant-registry";

const reserved = new Set(DEFAULT_TENANT_HOST_RESERVED_LABELS);

function readHost(req: IncomingMessage): string {
  const raw = req.headers.host;
  if (!raw) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

export async function handleTenantConfig(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const auth = await resolveTenantContextFromRequest(req);
    const rootDomain = process.env.TENANT_ROOT_DOMAIN ?? "localhost";
    const host = readHost(req).split(":")[0] ?? "";
    const labelOutcome = parseWorkspaceTenantLabelFromHost(host, rootDomain, reserved);

    let tenant =
      labelOutcome.kind === "label"
        ? findTenantBySubdomain(labelOutcome.label)
        : findTenantById(auth.tenantId);

    if (!tenant) {
      sendJson(res, 404, { error: "tenant_not_found" });
      return;
    }

    if (tenant.id !== auth.tenantId) {
      sendJson(res, 403, { error: "FORBIDDEN_TENANT_MISMATCH" });
      return;
    }

    sendJson(res, 200, {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
      workspaceType: tenant.workspaceType,
      theme: tenant.theme,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (message.startsWith("UNAUTHORIZED_") || message.startsWith("INVALID_TENANT")) {
      sendJson(res, 401, { error: message });
      return;
    }
    sendJson(res, 500, { error: "internal_error" });
  }
}
