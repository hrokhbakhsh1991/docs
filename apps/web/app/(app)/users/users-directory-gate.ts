import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { isOwnerRole } from "@/admin/require-operator-session";

export type UsersDirectoryBodyState =
  | { readonly type: "locked" }
  | { readonly type: "loading" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "empty" }
  | { readonly type: "empty-filtered" }
  | { readonly type: "directory" };

export type UsersDirectoryGateInput = {
  readonly session: OperatorSessionContext;
  readonly loading: boolean;
  readonly error: string | null;
  readonly usersLength: number;
  readonly hasActiveFilters: boolean;
};

export function resolveUsersDirectoryBodyState(
  input: UsersDirectoryGateInput
): UsersDirectoryBodyState {
  if (!isOwnerRole(input.session.role)) {
    return { type: "locked" };
  }
  if (input.loading) {
    return { type: "loading" };
  }
  if (input.error !== null) {
    return { type: "error", message: input.error };
  }
  if (input.usersLength === 0) {
    return { type: input.hasActiveFilters ? "empty-filtered" : "empty" };
  }
  return { type: "directory" };
}
