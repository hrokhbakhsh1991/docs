import { STRIPE_ACCOUNTS_V2_URL } from "./stripe.constants.ts";
import { StripeConnectV2RequestFailedError } from "./stripe.errors.ts";
import { stripeConnectV2Fetch } from "./stripe-http.ts";
import type {
  CreateStripeConnectV2AccountInput,
  StripeConnectV2AccountApiResponse,
  StripeConnectV2AccountResult,
} from "./stripe.types.ts";

function buildAccountBody(input: CreateStripeConnectV2AccountInput): Record<string, unknown> {
  return {
    contact_email: input.contactEmail.trim(),
    display_name: input.displayName.trim(),
    identity: {
      country: input.country.trim().toLowerCase(),
      entity_type: input.entityType ?? "company",
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            payouts: { requested: true },
          },
        },
      },
    },
    include: ["identity", "configuration.recipient"],
  };
}

/**
 * P5-D-N-005 — Stripe Connect Accounts v2 create (PSP-02).
 */
export async function createStripeConnectV2Account(
  input: CreateStripeConnectV2AccountInput
): Promise<StripeConnectV2AccountResult> {
  const payload = await stripeConnectV2Fetch<StripeConnectV2AccountApiResponse>({
    url: STRIPE_ACCOUNTS_V2_URL,
    body: buildAccountBody(input),
    fetch: input.fetch,
    secretKeyOverride: input.secretKeyOverride,
  });

  const accountId = payload.id?.trim();
  if (!accountId) {
    throw new StripeConnectV2RequestFailedError(
      STRIPE_ACCOUNTS_V2_URL,
      502,
      "Stripe Connect v2 account response missing id"
    );
  }

  return {
    accountId,
    object: payload.object ?? "v2.core.account",
  };
}
