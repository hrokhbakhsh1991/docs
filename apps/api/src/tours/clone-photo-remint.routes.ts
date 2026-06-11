import type { IncomingMessage, ServerResponse } from "node:http";

import {
  assertDenaliWizardDraftDestKey,
  executeDenaliWizardPhotoRemintPlan,
  readMinioPhotoConfigFromEnv,
} from "@app-tour/workspace-denali";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { readTourRequestBody } from "./read-tour-request-body";
import { parseClonePhotoRemintBody } from "./clone-photo-remint.schema";

export async function handleClonePhotoRemint(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const { parsedBody } = await readTourRequestBody(req);
    const body = parseClonePhotoRemintBody(parsedBody);
    const auth = await requireOperatorSession(req);

    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    if (workspaceType !== "denali") {
      sendHttpError(res, 403, {
        error: "forbidden",
        code: "WIZARD_PHOTO_REMINT_FORBIDDEN",
      });
      return;
    }

    if (body.plan.length === 0) {
      sendJson(res, 204, {});
      return;
    }

    for (const entry of body.plan) {
      assertDenaliWizardDraftDestKey(auth.tenantId, entry.destStorageKey);
    }

    const minioConfig = readMinioPhotoConfigFromEnv();
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
        await executeDenaliWizardPhotoRemintPlan({
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
