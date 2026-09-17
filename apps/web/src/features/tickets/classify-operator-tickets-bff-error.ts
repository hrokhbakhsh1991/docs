/**
 * TKT-G1 — operator tickets BFF error mapping.
 */
import { isTicketingHttpErrorCode } from "@app-tour/ticketing-http-contracts";

export type OperatorTicketsBffFailureKind =
  | "unauthenticated"
  | "unavailable"
  | "module_disabled"
  | "forbidden"
  | "api_error";

const MODULE_DISABLED_CODES = new Set([
  "TICKETING_WORKSPACE_UNSUPPORTED",
  "FORBIDDEN_TICKETING_MODULE_DISABLED",
  "TICKET_MODULE_DISABLED",
]);

export function readOperatorTicketsBffErrorCode(body: unknown): string | undefined {
  if (body === null || typeof body !== "object") {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  if (typeof record.code === "string" && record.code.trim().length > 0) {
    return record.code.trim();
  }
  const error = record.error;
  if (error !== null && typeof error === "object") {
    const nested = error as Record<string, unknown>;
    if (typeof nested.code === "string" && nested.code.trim().length > 0) {
      return nested.code.trim();
    }
  }
  return undefined;
}

export function classifyOperatorTicketsBffFailure(
  status: number,
  code?: string,
): OperatorTicketsBffFailureKind {
  const normalized = code?.trim() ?? "";
  if (status === 401 || normalized === "AUTH_UNAUTHENTICATED") {
    return "unauthenticated";
  }
  if (MODULE_DISABLED_CODES.has(normalized)) {
    return "module_disabled";
  }
  if (status === 403 || normalized === "TICKET_ACCESS_DENIED" || normalized === "FORBIDDEN_OPERATOR_FORBIDDEN") {
    return "forbidden";
  }
  if (isTicketingHttpErrorCode(normalized) && status >= 400 && status < 500) {
    return "api_error";
  }
  return "unavailable";
}

const PERSIAN_TICKET_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  TICKET_MODULE_DISABLED: "ماژول پشتیبانی برای این باشگاه فعال نیست.",
  TICKET_NOT_FOUND: "درخواست پشتیبانی پیدا نشد.",
  TICKET_CLOSED: "این درخواست بسته شده و امکان ارسال پیام جدید وجود ندارد.",
  TICKET_INVALID_TRANSITION: "وضعیت درخواست قابل تغییر نیست.",
  TICKET_VERSION_CONFLICT: "درخواست هم‌زمان به‌روزرسانی شده؛ صفحه را دوباره بارگذاری کنید.",
  ROW_VERSION_CONFLICT: "درخواست هم‌زمان به‌روزرسانی شده؛ صفحه را دوباره بارگذاری کنید.",
  TICKET_CATEGORY_INVALID: "دسته‌بندی انتخاب‌شده معتبر نیست.",
  IDEMPOTENCY_KEY_REQUIRED: "کلید یکتاسازی ارسال نشده است.",
  ZOD_VALIDATION_FAILED: "اطلاعات واردشده نامعتبر است.",
  BACKEND_UNREACHABLE: "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.",
  AUTH_UNAUTHENTICATED: "لطفاً دوباره وارد شوید.",
  TICKET_ACCESS_DENIED: "دسترسی به این درخواست مجاز نیست.",
};

export function localizeOperatorTicketsBffError(code: string, fallback: string): string {
  return PERSIAN_TICKET_ERROR_MESSAGES[code] ?? fallback;
}

export function mapOperatorTicketsMutationErrorCode(code: string): string {
  if (code === "ROW_VERSION_CONFLICT" || code === "TICKET_VERSION_CONFLICT") {
    return "versionConflict";
  }
  if (code === "TICKET_CLOSED") {
    return "ticketClosed";
  }
  if (code === "ZOD_VALIDATION_FAILED") {
    return "validation";
  }
  if (code === "IDEMPOTENCY_KEY_REQUIRED") {
    return "idempotency";
  }
  return "generic";
}
