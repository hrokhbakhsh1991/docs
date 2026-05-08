import type { WebSessionResponseBody } from "../auth/types";
import type { PhoneOtpLoginRequest } from "@repo/types";
import { apiClient } from "../api-client";
import { API } from "../api-paths";
import { normalizeOtpPhoneInput } from "../otp-phone-normalize";
import { resolveTourOpsApiBaseUrl } from "../tour-ops-api-origin";

/**
 * Web login: `phone` + `otp`; tenant scope comes from the HTTP Host on the API request.
 * Use fixed `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_API_DYNAMIC_ORIGIN` (+ optional port); see `tour-ops-api-origin.ts`.
 */
export async function loginWebSession(
  phone: string,
  otp: string
): Promise<WebSessionResponseBody> {
  if (!resolveTourOpsApiBaseUrl().trim()) {
    throw new Error(
      "Tour-Ops API base URL is not configured (set NEXT_PUBLIC_API_URL for SSR/build, or NEXT_PUBLIC_API_DYNAMIC_ORIGIN in the browser)."
    );
  }

  const body: PhoneOtpLoginRequest = {
    phone: normalizeOtpPhoneInput(phone),
    otp: otp.trim()
  };

  return apiClient.post<WebSessionResponseBody>(API.auth.webSession, body, {
    skipAuthRedirectOn401: true,
  });
}

export async function createWorkspaceSession(
  tenantId: string
): Promise<WebSessionResponseBody> {
  const cleanedTenantId = tenantId.trim();
  return apiClient.post<WebSessionResponseBody>(API.auth.workspaceSession, {
    tenant_id: cleanedTenantId
  });
}
