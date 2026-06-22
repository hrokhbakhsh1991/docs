export const STRIPE_API_HOST = "api.stripe.com" as const;

export const STRIPE_ALLOWED_HOSTS = [STRIPE_API_HOST] as const;

export const STRIPE_ACCOUNTS_V2_URL = `https://${STRIPE_API_HOST}/v2/core/accounts` as const;

export const STRIPE_ACCOUNT_LINKS_V2_URL =
  `https://${STRIPE_API_HOST}/v2/core/account_links` as const;

/** Pinned Accounts v2 preview — no v1 Account.create in P5-D. */
export const STRIPE_ACCOUNTS_V2_API_VERSION = "2026-05-27.dahlia" as const;

export const STRIPE_DEFAULT_ONBOARDING_CONFIGURATIONS = ["recipient"] as const;
