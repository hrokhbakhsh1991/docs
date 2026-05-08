import { apiClient } from "../api-client";
import { API } from "../api-paths";

/** Row from `GET /api/v2/auth/workspaces` (OpenAPI `AuthWorkspaceItemDto`). */
export type AuthWorkspaceListItem = {
  tenant_id: string;
  tenant_name: string;
  /** Empty when API returns no subdomain label yet. */
  tenant_subdomain?: string;
  role: string;
};

export async function getAuthWorkspaces(authToken?: string): Promise<AuthWorkspaceListItem[]> {
  return apiClient.get<AuthWorkspaceListItem[]>(API.auth.workspaces, {
    skipGlobalErrorToast: true,
    authToken,
  });
}
