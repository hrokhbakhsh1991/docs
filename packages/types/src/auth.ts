/**
 * Mirrors OpenAPI auth/session DTOs used by `AuthController_webSession` et al.
 * Wire payloads use snake_case as in `openapi.json`; align HTTP client serializers accordingly when wiring fetch.
 */

/** Maps `WebCredentialDto` */
export interface WebCredentialDto {
  email: string;
  password: string;
}

/** Maps `WebSessionDto` (request body shape from OpenAPI). */
export interface WebSessionDto {
  entry_mode: "web";
  credential: WebCredentialDto;
  asserted_tenant_id?: string;
}

/** Maps `WebSessionResponseDto` */
export interface WebSessionResponseDto {
  session_token: string;
  user_id: string;
  tenant_id: string;
  entry_mode: "web";
}

/**
 * Identifying slice for “current user” after web login.
 * OpenAPI does not yet define a separate User/Profile schema — this mirrors fields from `WebSessionResponseDto`.
 */
export type UserDto = Pick<WebSessionResponseDto, "user_id" | "tenant_id" | "entry_mode">;

/** Alias — same as `UserDto`. */
export type User = UserDto;
