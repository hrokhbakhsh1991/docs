import { formatIranMobileForDisplay } from "@app-tour/iran-mobile";

export const PUBLIC_REGISTRATION_DEV_PHONE = "+15550009901";
export const PUBLIC_REGISTRATION_DEV_OTP = "1234";

/**
 * Guest login phone starts empty. The US smoke number is a named fixture for
 * tests that fill the field — never a visible default (GL-PHONE-01).
 */
export function initialPublicRegistrationPhone(): string {
  return "";
}

export function initialPublicRegistrationOtp(): string {
  return process.env.NODE_ENV === "development" ? PUBLIC_REGISTRATION_DEV_OTP : "";
}

/**
 * Strip the US smoke fixture from a stored mobile string.
 * Login/register uses {@link guestLoginPhoneFieldValue}. The `/me` person chip
 * uses `resolveGuestMemberChipLabel` — do not wire this helper onto that chip.
 * `/me/profile` must keep showing the stored number (change via OTP).
 */
export function guestVisibleProfileMobile(mobile: string | null | undefined): string {
  const trimmed = typeof mobile === "string" ? mobile.trim() : "";
  if (trimmed.length === 0 || trimmed === PUBLIC_REGISTRATION_DEV_PHONE) {
    return "";
  }
  return formatIranMobileForDisplay(trimmed);
}

/**
 * Visible guest login/register phone (GL-PHONE-01). The US smoke fixture is
 * never a field value, even if flow state or browser autofill injects it.
 * Unlike {@link guestVisibleProfileMobile}, mid-typing spaces are preserved.
 */
export function guestLoginPhoneFieldValue(phone: string): string {
  if (phone.trim() === PUBLIC_REGISTRATION_DEV_PHONE) {
    return "";
  }
  return formatIranMobileForDisplay(phone);
}
