export type CreateStripeConnectV2AccountInput = {
  readonly contactEmail: string;
  readonly displayName: string;
  readonly country: string;
  readonly entityType?: "company" | "individual";
  readonly fetch?: typeof fetch;
  readonly secretKeyOverride?: string;
};

export type CreateStripeConnectV2AccountLinkInput = {
  readonly accountId: string;
  readonly returnUrl: string;
  readonly refreshUrl: string;
  readonly configurations?: readonly string[];
  readonly fetch?: typeof fetch;
  readonly secretKeyOverride?: string;
};

export type StripeConnectV2AccountResult = {
  readonly accountId: string;
  readonly object: string;
};

export type StripeConnectV2AccountLinkResult = {
  readonly accountId: string;
  readonly url: string;
  readonly object: string;
};

export type StripeConnectV2AccountApiResponse = {
  readonly id?: string;
  readonly object?: string;
};

export type StripeConnectV2AccountLinkApiResponse = {
  readonly account?: string;
  readonly url?: string;
  readonly object?: string;
};
