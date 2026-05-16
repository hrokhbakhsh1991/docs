import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";

/** Row from `GET /api/v2/auth/workspaces` (OpenAPI `AuthWorkspaceItemDto`). */
export type AuthWorkspaceListItem = {
  tenant_id: string;
  tenant_name: string;
  /** Empty when API returns no subdomain label yet. */
  tenant_subdomain?: string;
  role: string;
};

export async function getAuthWorkspaces(): Promise<AuthWorkspaceListItem[]> {
  return bffBrowserClient.get<AuthWorkspaceListItem[]>(BFF.authWorkspaces, {
    skipGlobalErrorToast: true,
  });
}
