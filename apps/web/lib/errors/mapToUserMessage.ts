import { ApiError } from "@/lib/api-client";

import { getUIError } from "./error-registry";

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
    if (direct && error.code === "REQUEST_FAILED") {
      return direct;
    }
    if (error.code && error.code !== "REQUEST_FAILED" && error.code !== "NETWORK_ERROR") {
      const ui = getUIError(error.code);
      if (direct && direct !== ui.message) {
        return direct;
      }
      return ui.message;
    }

    switch (error.code) {
      case "NETWORK_ERROR":
        return "Connection lost. Please check your network and try again.";
      case "TIMEOUT":
        return "Request timed out. Please try again.";
      case "FORBIDDEN":
        return getUIError("AUTH_FORBIDDEN_ABILITY").message;
      case "UNAUTHORIZED":
        return getUIError("AUTH_UNAUTHENTICATED").message;
      case "SERVER_ERROR":
        return getUIError("INTERNAL_ERROR").message;
      default:
        return direct || fallback;
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

