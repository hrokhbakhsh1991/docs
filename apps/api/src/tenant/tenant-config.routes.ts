import type { IncomingMessage, ServerResponse } from "node:http";

import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseWorkspaceTenantLabelFromHost,
} from "@app-tour/tenant-kernel";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import {
  getCachedTenantConfigPayload,
  setCachedTenantConfigPayload,
} from "./tenant-config-response-cache";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { mergeTenantConfigSurfaceTheme } from "./merge-tenant-config-surface-theme";
import {
  resolveRegisteredTenantById,
  resolveRegisteredTenantBySubdomain,
  resolveTenantThemeJsonById,
} from "./resolve-registered-tenant";

const reserved = new Set(DEFAULT_TENANT_HOST_RESERVED_LABELS);

function readHost(req: IncomingMessage): string {
  const raw = req.headers.host;
  if (!raw) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

export async function handleTenantConfig(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const auth = await resolveTenantContextFromRequest(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rootDomain = process.env.TENANT_ROOT_DOMAIN ?? "localhost";
        const host = readHost(req).split(":")[0] ?? "";
        const labelOutcome = parseWorkspaceTenantLabelFromHost(host, rootDomain, reserved);

        const tenant =
          labelOutcome.kind === "label"
            ? await resolveRegisteredTenantBySubdomain(labelOutcome.label)
            : await resolveRegisteredTenantById(auth.tenantId);

        if (!tenant) {
          sendHttpError(res, 404, { error: "tenant_not_found", code: "TENANT_NOT_FOUND" });
          return;
        }

        if (tenant.id !== auth.tenantId) {
          sendHttpError(res, 403, {
            error: "FORBIDDEN_TENANT_MISMATCH",
            code: "FORBIDDEN_TENANT_MISMATCH",
          });
          return;
        }

        const cachedPayload = getCachedTenantConfigPayload(tenant.id);
        if (cachedPayload !== undefined) {
          sendJson(res, 200, cachedPayload);
          return;
        }

        const rawTheme = await resolveTenantThemeJsonById(tenant.id);
        const theme = mergeTenantConfigSurfaceTheme(tenant.theme, rawTheme);

        const payload = JSON.stringify({
          tenantId: tenant.id,
          subdomain: tenant.subdomain,
          workspaceType: tenant.workspaceType,
          theme,
        });
        setCachedTenantConfigPayload(tenant.id, payload);
        sendJson(res, 200, payload);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
