import type { WebSessionRequestBody, WebSessionResponseBody } from "../auth/types";
import { apiClient } from "../api-client";
import { API } from "../api-paths";

/** Matches Docker/example defaults; real login needs the seeded tenant UUID from DB. */
const PLACEHOLDER_NEXT_PUBLIC_TENANT_ID = "11111111-1111-4111-8111-111111111111";

export type LoginWebSessionOptions = {
  /** Membership must exist for this tenant (e.g. workspace picker). Defaults to NEXT_PUBLIC_TENANT_ID. */
  assertedTenantId?: string;
};

function resolveAssertedTenantId(override?: string): string {
  const assertedTenantId = override?.trim() || process.env.NEXT_PUBLIC_TENANT_ID?.trim();
  if (!assertedTenantId) {
    throw new Error("NEXT_PUBLIC_TENANT_ID is not configured.");
  }
  if (assertedTenantId === PLACEHOLDER_NEXT_PUBLIC_TENANT_ID) {
    throw new Error(
      "NEXT_PUBLIC_TENANT_ID هنوز UUID نمونه است (۱۱۱۱…). آن را با UUID واقعی tenant در دیتابیس جایگزین کنید؛ برای dev محلی `.env.local` را درست کنید و `pnpm dev` را ری‌استارت کنید؛ برای Docker حداقل `docker compose build --no-cache web` را بزنید و سرویس web را دوباره بالا بیاورید."
    );
  }
  return assertedTenantId;
}

export async function loginWebSession(
  email: string,
  password: string,
  options?: LoginWebSessionOptions
): Promise<WebSessionResponseBody> {
  const assertedTenantId = resolveAssertedTenantId(options?.assertedTenantId);
  const baseURL = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!baseURL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const body: WebSessionRequestBody = {
    entry_mode: "web",
    credential: { email: email.trim(), password },
    asserted_tenant_id: assertedTenantId,
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
