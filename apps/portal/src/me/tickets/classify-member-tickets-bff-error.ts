/**
 * TKT-F1 — map ticketing BFF/API failures to portal UI states.
 */
import { isTicketingHttpErrorCode } from "@app-tour/ticketing-http-contracts";

import { classifyMemberProfileBffFailure, readMemberBffErrorCode } from "../classify-member-profile-bff-error";

export type MemberTicketsBffFailureKind =
  | "unauthenticated"
  | "unavailable"
  | "workspace_disabled"
  | "module_disabled"
  | "api_error";

const WORKSPACE_DISABLED_CODES = new Set([
  "TICKETING_WORKSPACE_UNSUPPORTED",
  "FORBIDDEN_TICKETING_MODULE_DISABLED",
  "TICKET_MODULE_DISABLED",
]);

export function readMemberTicketsBffErrorCode(body: unknown): string | undefined {
  return readMemberBffErrorCode(body);
}

export function classifyMemberTicketsBffFailure(
  status: number,
  code?: string,
): MemberTicketsBffFailureKind {
  const normalized = code?.trim() ?? "";
  if (WORKSPACE_DISABLED_CODES.has(normalized)) {
    return normalized === "TICKET_MODULE_DISABLED" || normalized === "FORBIDDEN_TICKETING_MODULE_DISABLED"
      ? "module_disabled"
      : "workspace_disabled";
  }
  if (isTicketingHttpErrorCode(normalized) && status >= 400 && status < 500) {
    return "api_error";
  }
  const sessionKind = classifyMemberProfileBffFailure(status, code);
  if (sessionKind === "unauthenticated") {
    return "unauthenticated";
  }
  return "unavailable";
}

const PERSIAN_TICKET_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  TICKET_MODULE_DISABLED: "ماژول پشتیبانی برای این باشگاه فعال نیست.",
  TICKET_NOT_FOUND: "درخواست پشتیبانی پیدا نشد.",
  TICKET_CLOSED: "این درخواست بسته شده و امکان ارسال پیام جدید وجود ندارد.",
  TICKET_INVALID_TRANSITION: "وضعیت درخواست قابل تغییر نیست.",
  TICKET_VERSION_CONFLICT: "درخواست هم‌زمان به‌روزرسانی شده؛ صفحه را دوباره بارگذاری کنید.",
  TICKET_CATEGORY_INVALID: "دسته‌بندی انتخاب‌شده معتبر نیست.",
  TICKET_ATTACHMENT_TOO_LARGE: "حجم فایل بیش از حد مجاز است.",
  TICKET_ATTACHMENT_UNSUPPORTED_TYPE: "نوع فایل پشتیبانی نمی‌شود.",
  TICKET_ATTACHMENT_SCAN_REJECTED: "فایل قابل پذیرش نیست.",
  TICKET_ATTACHMENT_INVALID_FILE: "فایل نامعتبر است.",
  IDEMPOTENCY_KEY_REQUIRED: "کلید یکتاسازی ارسال نشده است.",
  ZOD_VALIDATION_FAILED: "اطلاعات واردشده نامعتبر است.",
  BACKEND_UNREACHABLE: "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.",
  AUTH_UNAUTHENTICATED: "لطفاً دوباره وارد شوید.",
};

export function localizeMemberTicketsBffError(code: string, fallback: string): string {
  return PERSIAN_TICKET_ERROR_MESSAGES[code] ?? fallback;
}
