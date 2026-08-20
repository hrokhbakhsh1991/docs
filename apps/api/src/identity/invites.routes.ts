import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import {
  acceptWorkspaceInvite,
  InvitePhoneMismatchError,
  InviteTenantMismatchError,
} from "./invites.service";
import {
  InviteAcceptConflictError,
  InviteLifecycleError,
  InviteNotFoundError,
} from "./in-memory-identity.repository";
import {
  INVITE_ACCEPT_OWNER_PROTECTED,
  OwnerCreateForbiddenError,
} from "./users-rbac.policy";
import { requireOperatorSession } from "./require-operator-session";
import { IdentityRequiredError } from "./identity.errors";

export async function handleAcceptInvite(
  req: IncomingMessage,
  res: ServerResponse,
  inviteToken: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await acceptWorkspaceInvite(auth, inviteToken);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (error instanceof IdentityRequiredError) {
      sendHttpError(res, 401, { error: "unauthenticated", code: "AUTH_UNAUTHENTICATED" });
      return;
    }
    if (error instanceof InviteNotFoundError) {
      sendHttpError(res, 404, { error: "not_found", code: error.code, inviteId: error.inviteId });
      return;
    }
    if (error instanceof InvitePhoneMismatchError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code });
      return;
    }
    if (error instanceof InviteTenantMismatchError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code });
      return;
    }
    if (error instanceof InviteAcceptConflictError) {
      if (error.code === INVITE_ACCEPT_OWNER_PROTECTED) {
        sendHttpError(res, 403, { error: "forbidden", code: error.code });
        return;
      }
      sendHttpError(res, 409, { error: "conflict", code: error.code });
      return;
    }
    if (error instanceof InviteLifecycleError) {
      sendHttpError(res, 410, { error: "gone", code: error.code, inviteId: error.inviteId });
      return;
    }
    if (error instanceof OwnerCreateForbiddenError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}
