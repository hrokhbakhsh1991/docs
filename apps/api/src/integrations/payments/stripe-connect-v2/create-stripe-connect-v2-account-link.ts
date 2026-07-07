import { STRIPE_ACCOUNT_LINKS_V2_URL, STRIPE_DEFAULT_ONBOARDING_CONFIGURATIONS } from "./stripe.constants.ts";
import { StripeConnectV2RequestFailedError } from "./stripe.errors.ts";
import { assertTenantControlledStripeUrl, stripeConnectV2Fetch } from "./stripe-http.ts";
import type {
  CreateStripeConnectV2AccountLinkInput,
  StripeConnectV2AccountLinkApiResponse,
  StripeConnectV2AccountLinkResult,
} from "./stripe.types.ts";

/**
 * P5-D-N-005 — Stripe Connect Accounts v2 onboarding link (PSP-02b).
 */
export async function createStripeConnectV2AccountLink(
  input: CreateStripeConnectV2AccountLinkInput
): Promise<StripeConnectV2AccountLinkResult> {
  assertTenantControlledStripeUrl(input.returnUrl);
  assertTenantControlledStripeUrl(input.refreshUrl);

  const configurations =
    input.configurations !== undefined && input.configurations.length > 0
      ? input.configurations
      : STRIPE_DEFAULT_ONBOARDING_CONFIGURATIONS;

  const payload = await stripeConnectV2Fetch<StripeConnectV2AccountLinkApiResponse>({
    url: STRIPE_ACCOUNT_LINKS_V2_URL,
    body: {
      account: input.accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations,
          return_url: input.returnUrl,
          refresh_url: input.refreshUrl,
        },
      },
    },
    fetch: input.fetch,
    secretKeyOverride: input.secretKeyOverride,
  });

  const url = payload.url?.trim();
  if (!url) {
    throw new StripeConnectV2RequestFailedError(
      STRIPE_ACCOUNT_LINKS_V2_URL,
      502,
      "Stripe Connect v2 account link response missing url"
    );
  }

  return {
    accountId: payload.account ?? input.accountId,
    url,
    object: payload.object ?? "v2.core.account_link",
  };
}
