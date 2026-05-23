import { ApiError } from "@/lib/api-client";
import { mapToUserMessage, type MapToUserMessageOptions } from "@/lib/errors/mapToUserMessage";
import { getUIError } from "@/lib/errors/error-registry";

const FINANCE_FALLBACK = "درخواست انجام نشد. لطفاً دوباره تلاش کنید.";

/**
 * Finance-panel error mapper: Persian fallbacks and network strings; registry codes when known.
 */
export function mapFinanceToUserMessage(
  error: unknown,
  options?: MapToUserMessageOptions
): string {
  const fallback = options?.fallback ?? FINANCE_FALLBACK;

  if (!error) return fallback;

  if (error instanceof ApiError) {
    if (error.code && error.code !== "REQUEST_FAILED" && error.code !== "NETWORK_ERROR") {
      const ui = getUIError(error.code);
      const direct = error.message?.trim();
      if (direct && direct !== ui.message) {
        return direct;
      }
      return ui.message;
    }

    switch (error.code) {
      case "NETWORK_ERROR":
        return "اتصال قطع شد. شبکه را بررسی کنید و دوباره تلاش کنید.";
      case "TIMEOUT":
        return "مهلت درخواست تمام شد. لطفاً دوباره تلاش کنید.";
      default:
        break;
    }
  }

  return mapToUserMessage(error, { ...options, fallback });
}
