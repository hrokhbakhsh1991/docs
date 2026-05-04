import { apiClient } from "../api-client";
import { API } from "../api-paths";

/** Row from `GET /api/v2/auth/workspaces` (OpenAPI `AuthWorkspaceItemDto`). */
export type AuthWorkspaceListItem = {
  tenant_id: string;
  tenant_name: string;
  role: string;
};

export async function getAuthWorkspaces(): Promise<AuthWorkspaceListItem[]> {
  return apiClient.get<AuthWorkspaceListItem[]>(API.auth.workspaces, {
    skipGlobalErrorToast: true,
  });
}
