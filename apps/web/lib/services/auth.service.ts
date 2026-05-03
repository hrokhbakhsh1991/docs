import type { WebSessionRequestBody, WebSessionResponseBody } from "../auth/types";
import { apiClient } from "../api-client";

export async function loginWebSession(
  email: string,
  password: string
): Promise<WebSessionResponseBody> {
  const assertedTenantId = process.env.NEXT_PUBLIC_TENANT_ID?.trim();
  if (!assertedTenantId) {
    throw new Error("NEXT_PUBLIC_TENANT_ID is not configured.");
  }
  const baseURL = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!baseURL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const body: WebSessionRequestBody = {
    entry_mode: "web",
    credential: { email: email.trim(), password },
    asserted_tenant_id: assertedTenantId,
  };

  return apiClient.post<WebSessionResponseBody>("/api/v2/auth/web/session", body, {
    skipAuthRedirectOn401: true,
  });
}
