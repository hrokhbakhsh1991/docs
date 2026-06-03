export type AuthContextErrorCode =
  | "AUTH_CONTEXT_NOT_OBJECT"
  | "AUTH_USER_ID_INVALID"
  | "AUTH_TENANT_ID_INVALID"
  | "AUTH_ROLE_INVALID"
  | "AUTH_STATUS_INVALID"
  | "AUTH_WORKSPACE_ID_INVALID"
  | "AUTH_SCOPE_ID_INVALID";

export class InvalidTenantAuthContextError extends Error {
  readonly code: AuthContextErrorCode;

  constructor(code: AuthContextErrorCode, message: string) {
    super(message);
    this.name = "InvalidTenantAuthContextError";
    this.code = code;
  }
}
