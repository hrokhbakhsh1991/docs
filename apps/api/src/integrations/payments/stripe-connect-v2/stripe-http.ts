import { assertSafeOutboundUrl } from "../../egress/assert-safe-outbound-url.ts";
import {
  STRIPE_ACCOUNTS_V2_API_VERSION,
  STRIPE_ALLOWED_HOSTS,
} from "./stripe.constants.ts";
import { StripeConnectV2RequestFailedError } from "./stripe.errors.ts";
import { resolveStripeSecretKey } from "./resolve-stripe-secret-key.ts";

export type StripeConnectV2FetchInput = {
  readonly url: string;
  readonly body: unknown;
  readonly fetch?: typeof fetch;
  readonly secretKeyOverride?: string;
};

export async function stripeConnectV2Fetch<T>(
  input: StripeConnectV2FetchInput
): Promise<T> {
  assertSafeOutboundUrl({
    url: input.url,
    allowedHosts: STRIPE_ALLOWED_HOSTS,
  });

  const secretKey = resolveStripeSecretKey(input.secretKeyOverride);
  const fetchImpl = input.fetch ?? fetch;
  const response = await fetchImpl(input.url, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
      "stripe-version": STRIPE_ACCOUNTS_V2_API_VERSION,
    },
    body: JSON.stringify(input.body),
  });

  const payload = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new StripeConnectV2RequestFailedError(
      input.url,
      response.status,
      payload.error?.message ?? `Stripe Connect v2 request failed (${response.status})`
    );
  }

  return payload;
}

export function assertTenantControlledStripeUrl(url: string): void {
  assertSafeOutboundUrl(url);
}
