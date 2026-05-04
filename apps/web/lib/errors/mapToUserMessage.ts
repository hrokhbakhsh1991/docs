import { ApiError } from "@/lib/api-client";

export type MapToUserMessageOptions = {
  fallback?: string;
};

/**
 * Single mapper for presenting API/runtime errors to end users.
 * Keep UI copy centralized so wording changes happen in one place.
 */
export function mapToUserMessage(error: unknown, options?: MapToUserMessageOptions): string {
  const fallback = options?.fallback ?? "Request failed.";

  if (!error) return fallback;

  if (error instanceof ApiError) {
    const direct = error.message?.trim();
    if (direct) return direct;

    switch (error.code) {
      case "NETWORK_ERROR":
        return "Connection lost. Please check your network and try again.";
      case "TIMEOUT":
        return "Request timed out. Please try again.";
      case "FORBIDDEN":
        return "You are not allowed to perform this action.";
      case "UNAUTHORIZED":
        return "Your session has expired. Please sign in again.";
      case "SERVER_ERROR":
        return "Server error. Please try again later.";
      default:
        return fallback;
    }
  }

  if (error instanceof Error) {
    const message = error.message?.trim();
    return message || fallback;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
}

