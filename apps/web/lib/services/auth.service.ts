import type { WebSessionResponseBody } from "../auth/types";
import type { PhoneOtpLoginRequest } from "@repo/types";
import { ApiError } from "../api-client";
import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";
import { normalizeOtpPhoneInput } from "../otp-phone-normalize";

type BffLoginOk = {
  ok: true;
  session_token: string;
  user_id?: string;
  tenant_id?: string;
};

type BffLoginErr = {
  ok?: false;
  error?: { code?: string; message?: string };
  message?: string;
};

function isBffLoginOk(payload: BffLoginOk | BffLoginErr | null | undefined): payload is BffLoginOk {
  return Boolean(payload && payload.ok === true && payload.session_token?.trim());
}

function loginFailureFromPayload(payload: BffLoginOk | BffLoginErr | null | undefined): {
  code: string;
  message: string;
} {
  if (payload && !isBffLoginOk(payload)) {
    return {
      code: payload.error?.code ?? "AUTH_FAILED",
      message: payload.error?.message ?? payload.message ?? "Login failed",
    };
  }
  return { code: "AUTH_FAILED", message: "Login failed" };
}

function toWebSession(body: BffLoginOk): WebSessionResponseBody {
  const userId = body.user_id?.trim() ?? "";
  const tenantId = body.tenant_id?.trim() ?? "";
  if (!userId || !tenantId) {
    throw new ApiError("AUTH_SESSION_INVALID", "Session was not established. Please try again.");
  }
  return {
    session_token: body.session_token,
    user_id: userId,
    tenant_id: tenantId,
    entry_mode: "web",
  };
}

/**
 * Web login via same-origin BFF (`POST /api/auth/login-web-session`).
 * Tenant scope comes from HTTP Host on the upstream Nest request.
 */
export async function loginWebSession(
  phone: string,
  otp: string,
  inviteToken?: string,
): Promise<WebSessionResponseBody> {
  const body: PhoneOtpLoginRequest = {
    phone: normalizeOtpPhoneInput(phone),
    otp: otp.trim(),
  };
  const payload = await bffBrowserClient.post<BffLoginOk | BffLoginErr>(
    BFF.authLoginWebSession,
    {
      ...body,
      ...(inviteToken?.trim() ? { invite_token: inviteToken.trim() } : {}),
    },
    { skipAuthRedirectOn401: true },
  );
  if (!isBffLoginOk(payload)) {
    const { code, message } = loginFailureFromPayload(payload);
    throw new ApiError(code, message);
  }
  return toWebSession(payload);
}

export async function createWorkspaceSession(
  tenantId: string,
): Promise<WebSessionResponseBody> {
  const cleanedTenantId = tenantId.trim();
  const payload = await bffBrowserClient.post<BffLoginOk | BffLoginErr>(
    BFF.authWorkspaceSession,
    { tenant_id: cleanedTenantId },
    { skipGlobalErrorToast: true },
  );
  if (!isBffLoginOk(payload)) {
    const failure = loginFailureFromPayload(payload);
    throw new ApiError(
      failure.code,
      failure.message === "Login failed" ? "Workspace session failed" : failure.message,
    );
  }
  return toWebSession(payload);
}
