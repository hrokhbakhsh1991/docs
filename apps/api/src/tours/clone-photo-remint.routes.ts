import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { readTourRequestBody } from "./read-tour-request-body";
import { parseClonePhotoRemintBody } from "./clone-photo-remint.schema";
import { resolveWizardCloneRemintBinding } from "./workspace-wizard-clone-remint-dispatch";

export async function handleClonePhotoRemint(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const { parsedBody } = await readTourRequestBody(req);
    const body = parseClonePhotoRemintBody(parsedBody);
    const auth = await requireOperatorSession(req);

    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    const binding = resolveWizardCloneRemintBinding(workspaceType);
    if (binding === undefined) {
      sendHttpError(res, 403, {
        error: "forbidden",
        code: "WIZARD_CLONE_REMINT_UNBOUND",
      });
      return;
    }

    if (body.plan.length === 0) {
      sendJson(res, 204, {});
      return;
    }

    for (const entry of body.plan) {
      binding.assertDestKey(auth.tenantId, entry.destStorageKey);
    }

    const minioConfig = binding.readConfigFromEnv();
    if (minioConfig === null) {
      sendHttpError(res, 503, {
        error: "service_unavailable",
        code: "MINIO_NOT_CONFIGURED",
      });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        await binding.executeRemint({
          config: minioConfig,
          tenantId: auth.tenantId,
          plan: body.plan,
        });
        sendJson(res, 204, {});
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
