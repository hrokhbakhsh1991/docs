import { ZibalMerchantNotConfiguredError } from "./zibal.errors.ts";

/**
 * Merchant credential lives in env only — never workspace metadata (P5-D F4).
 */
export function resolveZibalMerchant(override?: string): string {
  const merchant = override?.trim() || process.env.ZIBAL_MERCHANT?.trim();
  if (!merchant) {
    throw new ZibalMerchantNotConfiguredError();
  }
  return merchant;
}
