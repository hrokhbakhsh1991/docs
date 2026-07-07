import { assertSafeOutboundUrl } from "../../egress/assert-safe-outbound-url.ts";
import {
  buildZibalPaymentStartUrl,
  ZIBAL_ALLOWED_HOSTS,
  ZIBAL_REQUEST_URL,
  ZIBAL_SUCCESS_RESULT,
} from "./zibal.constants.ts";
import { ZibalPaymentRequestFailedError } from "./zibal.errors.ts";
import { resolveZibalMerchant } from "./resolve-zibal-merchant.ts";
import type {
  CreateZibalPaymentRequestInput,
  ZibalPaymentRequestResult,
  ZibalRequestApiBody,
  ZibalRequestApiResponse,
} from "./zibal.types.ts";

function parseTrackId(value: string | number | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trackId = String(value).trim();
  return trackId.length > 0 ? trackId : null;
}

function assertPositiveAmount(amountMinor: number): void {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new ZibalPaymentRequestFailedError(
      -1,
      null,
      `Zibal amount must be a positive integer Rial amount, got ${amountMinor}`
    );
  }
}

/**
 * P5-D-N-004 — outbound Zibal payment intent (PSP-01).
 * Validates tenant callback URL + pinned gateway host before POST.
 */
export async function createZibalPaymentRequest(
  input: CreateZibalPaymentRequestInput
): Promise<ZibalPaymentRequestResult> {
  assertPositiveAmount(input.amountMinor);
  assertSafeOutboundUrl(input.callbackUrl);

  assertSafeOutboundUrl({
    url: ZIBAL_REQUEST_URL,
    allowedHosts: ZIBAL_ALLOWED_HOSTS,
  });

  const merchant = resolveZibalMerchant(input.merchantOverride);
  const body: ZibalRequestApiBody = {
    merchant,
    amount: input.amountMinor,
    callbackUrl: input.callbackUrl,
    orderId: input.orderId,
    ...(input.description !== undefined && input.description.trim().length > 0
      ? { description: input.description.trim() }
      : {}),
  };

  const fetchImpl = input.fetch ?? fetch;
  const response = await fetchImpl(ZIBAL_REQUEST_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as ZibalRequestApiResponse;
  const trackId = parseTrackId(payload.trackId);

  if (payload.result !== ZIBAL_SUCCESS_RESULT || trackId === null) {
    throw new ZibalPaymentRequestFailedError(payload.result, trackId, payload.message);
  }

  return {
    result: payload.result,
    trackId,
    redirectUrl: buildZibalPaymentStartUrl(trackId),
  };
}
