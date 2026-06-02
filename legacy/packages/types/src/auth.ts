/**
 * Mirrors OpenAPI auth DTOs for `POST /api/v2/auth/web/session/otp`.
 * Wire payloads use snake_case as in `openapi.json`.
 */

export interface PhoneOtpLoginRequest {
  phone: string;
  otp: string;
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
