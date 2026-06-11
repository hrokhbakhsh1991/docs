import type { IncomingMessage, ServerResponse } from "node:http";

import { getUrbanHttpHost } from "./host-runtime";
import { assertWorkspaceOwner } from "./require-workspace-owner";
import { parseUrbanSettingsPatchBody } from "./schemas/urban-settings-patch.schema";
import { getUrbanSettings, patchUrbanSettings } from "./settings.service";

export async function handleGetUrbanSettings(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const host = getUrbanHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const workspaceType = await host.resolveWorkspaceTypeForTenant(auth.tenantId);
    assertWorkspaceOwner({
      auth,
      workspaceType,
      surface: "urban.settings.read",
    });

    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const envelope = await getUrbanSettings(auth, workspaceType);
        host.sendJson(res, 200, envelope);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handlePatchUrbanSettings(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const host = getUrbanHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const workspaceType = await host.resolveWorkspaceTypeForTenant(auth.tenantId);
    assertWorkspaceOwner({
      auth,
      workspaceType,
      surface: "urban.settings.update",
    });

    const parsedBody = await host.readUrbanSettingsRequestBody(req);
    const patchBody = parseUrbanSettingsPatchBody(parsedBody);

    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const responseBody = await patchUrbanSettings(auth, patchBody);
        host.sendJson(res, 200, responseBody);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}
