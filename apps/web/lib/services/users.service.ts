import { apiClient } from "../api-client";
import { API } from "../api-paths";

/** When true, list/update users against Tour-Ops API (`NEXT_PUBLIC_API_URL`). */
export function usersUseLiveApi(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());
}

/**
 * Tenant directory row from `GET /api/v2/users` → `UserResponseDto`.
 */
export type WorkspaceUserDto = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Invited";
};

export async function getUsers(): Promise<WorkspaceUserDto[]> {
  return apiClient.get<WorkspaceUserDto[]>(API.users);
}

/**
 * Resolve a user by id using `GET /api/v2/users` only (OpenAPI does not define `GET /users/{id}`).
 */
export async function getUserById(id: string): Promise<WorkspaceUserDto | null> {
  const rows = await getUsers();
  return rows.find((u) => u.id === id) ?? null;
}

export async function updateUserRole(id: string, role: string): Promise<WorkspaceUserDto> {
  return apiClient.patch<WorkspaceUserDto>(API.user(id), {
    role
  });
}
