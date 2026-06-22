import { PaymentsWebhookSigningSecretNotConfiguredError } from "./webhook.errors.ts";

export function resolvePaymentsWebhookSigningSecret(override?: string): string {
  const secret = override?.trim() || process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET?.trim();
  if (!secret) {
    throw new PaymentsWebhookSigningSecretNotConfiguredError();
  }
  return secret;
}
