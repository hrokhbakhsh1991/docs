export type PasswordPolicyErrorCode =
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "PASSWORD_TOO_COMMON";

// A local denylist provides a predictable baseline without transmitting even a
// password hash prefix to a third party. Keep entries normalized and lowercase.
const COMMON_PASSWORDS = new Set([
  "passwordpassword",
  "password123456789",
  "123456789012345",
  "1234567890123456",
  "12345678901234567890",
  "qwertyuiopasdfgh",
  "iloveyouiloveyou",
  "adminadminadmin",
]);

export function validateNewPassword(password: string): PasswordPolicyErrorCode | null {
  const normalized = password.normalize("NFC");
  const length = Array.from(normalized).length;
  if (length < 15) return "PASSWORD_TOO_SHORT";
  if (length > 128) return "PASSWORD_TOO_LONG";
  const folded = normalized.toLowerCase();
  if (
    COMMON_PASSWORDS.has(folded) ||
    COMMON_BREACHED_PASSWORDS.has(folded) ||
    /^([\s\S]{1,4})\1+$/u.test(normalized)
  ) {
    return "PASSWORD_TOO_COMMON";
  }
  return null;
}
import { COMMON_BREACHED_PASSWORDS } from "./common-passwords";
