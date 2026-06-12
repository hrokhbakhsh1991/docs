import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError } from "../middleware/error-interceptor";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { readUrbanSettingsRequestBody } from "./read-urban-settings-request-body";
import { assertWorkspaceOwner } from "@app-tour/workspace-urban/http";
import { parseUrbanSettingsPatchBody } from "./schemas/urban-settings-patch.schema";
import { getUrbanSettings, patchUrbanSettings } from "./urban-settings.service";

export async function handleGetUrbanSettings(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await resolveTenantContextFromRequest(req);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    assertWorkspaceOwner({
      auth,
      workspaceType,
      surface: "urban.settings.read",
    });

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const envelope = await getUrbanSettings(auth, workspaceType);
        sendJson(res, 200, envelope);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handlePatchUrbanSettings(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await resolveTenantContextFromRequest(req);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    assertWorkspaceOwner({
      auth,
      workspaceType,
      surface: "urban.settings.update",
    });

    const parsedBody = await readUrbanSettingsRequestBody(req);
    const patchBody = parseUrbanSettingsPatchBody(parsedBody);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const responseBody = await patchUrbanSettings(auth, patchBody);
        sendJson(res, 200, responseBody);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
