import { ApiError } from "../api-client";

/**
 * Shared auth-flow error copy for login/workspace fetch flows.
 */
export function resolveAuthUiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("not configured")) {
    return "Application configuration is incomplete. Set NEXT_PUBLIC_API_DYNAMIC_ORIGIN=true and NEXT_PUBLIC_API_PORT so API requests use the workspace host.";
  }
  if (error instanceof ApiError) {
    if (error.code === "AUTH_OTP_INVALID") {
      return "Invalid OTP code.";
    }
    if (error.code === "AUTH_OTP_EXPIRED") {
      return "OTP has expired. Request a new code and try again.";
    }
    if (error.code === "AUTH_PHONE_INVALID" || error.code === "AUTH_UNAUTHENTICATED") {
      return "Invalid phone number or OTP.";
    }
    return error.message.trim() || "Invalid phone or OTP.";
  }
  if (error instanceof Error) {
    return error.message.trim() || "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

