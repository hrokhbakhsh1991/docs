import type { MeProfileWire } from "@repo/types";

import { ApiError } from "@/lib/api-client";
import {
  asciiDigitsFromNationalIdRaw,
  isValidIranNationalIdChecksum,
} from "@/lib/iran-national-id";
import { patchMe } from "@/lib/me-client";

function isMeProfileWire(body: unknown): body is MeProfileWire {
  return (
    body != null &&
    typeof body === "object" &&
    "id" in body &&
    typeof (body as MeProfileWire).id === "string"
  );
}

function mePatchErrorMessage(payload: unknown, fallback: string): string {
  if (payload != null && typeof payload === "object") {
    const row = payload as { error?: { message?: string; code?: string } };
    const msg = row.error?.message?.trim();
    if (msg) {
      return msg;
    }
    const code = row.error?.code?.trim();
    if (code === "VALIDATION_FIELD_FORMAT_INVALID") {
      return "کد ملی وارد شده معتبر نیست.";
    }
    if (code === "CONCURRENCY_CONFLICT") {
      return "پروفایل شما هم‌زمان به‌روزرسانی شد. صفحه را تازه‌سازی کنید و دوباره تلاش کنید.";
    }
  }
  return fallback;
}

/**
 * Persists national ID on the signed-in user via `PATCH /api/me` (required before self-register on NID tours).
 */
export async function patchMeNationalId(
  nationalIdRaw: string,
  me: MeProfileWire,
): Promise<MeProfileWire> {
  const digits = asciiDigitsFromNationalIdRaw(nationalIdRaw.trim());
  if (digits.length === 0) {
    throw new ApiError("VALIDATION_REQUIRED_FIELD_MISSING", "کد ملی الزامی است.", 400);
  }
  if (digits.length !== 10 || !isValidIranNationalIdChecksum(digits)) {
    throw new ApiError("VALIDATION_FIELD_FORMAT_INVALID", "کد ملی وارد شده معتبر نیست.", 400);
  }

  const version = me.profile_row_version;
  const ifMatch =
    typeof version === "number" && Number.isFinite(version) ? `W/"${String(version)}"` : undefined;

  const res = await patchMe(
    { national_id: digits },
    ifMatch !== undefined ? { ifMatch } : undefined,
  );
  const body: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const code =
      typeof body === "object" && body != null && "error" in body
        ? String((body as { error?: { code?: string } }).error?.code ?? "ME_PATCH_FAILED")
        : "ME_PATCH_FAILED";
    throw new ApiError(
      code,
      mePatchErrorMessage(body, "ذخیره کد ملی در پروفایل ناموفق بود."),
      res.status,
      body,
    );
  }

  if (!isMeProfileWire(body)) {
    throw new ApiError("ME_PATCH_INVALID_RESPONSE", "پاسخ نامعتبر از سرور پروفایل.", res.status);
  }

  return body;
}
