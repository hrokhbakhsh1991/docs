export type CreateZibalPaymentRequestInput = {
  /** Amount in Rials (Zibal expects integer Rials). */
  readonly amountMinor: number;
  /** Tenant-controlled redirect URL — validated by egress guard before POST. */
  readonly callbackUrl: string;
  /** Merchant order identifier (idempotency anchor with tenantId). */
  readonly orderId: string;
  readonly tenantId: string;
  readonly description?: string;
  /** Test seam — defaults to global fetch. */
  readonly fetch?: typeof fetch;
  /** Test seam — overrides env merchant when set. */
  readonly merchantOverride?: string;
};

export type ZibalRequestApiBody = {
  readonly merchant: string;
  readonly amount: number;
  readonly callbackUrl: string;
  readonly orderId: string;
  readonly description?: string;
};

export type ZibalRequestApiResponse = {
  readonly result: number;
  readonly trackId?: string | number;
  readonly message?: string;
};

export type ZibalPaymentRequestResult = {
  readonly result: number;
  readonly trackId: string;
  readonly redirectUrl: string;
};
