import { StripeSecretKeyNotConfiguredError } from "./stripe.errors.ts";

export function resolveStripeSecretKey(override?: string): string {
  const secretKey = override?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new StripeSecretKeyNotConfiguredError();
  }
  return secretKey;
}
