export const ZIBAL_GATEWAY_HOST = "gateway.zibal.ir" as const;

export const ZIBAL_REQUEST_PATH = "/v1/request" as const;

export const ZIBAL_REQUEST_URL = `https://${ZIBAL_GATEWAY_HOST}${ZIBAL_REQUEST_PATH}` as const;

export const ZIBAL_ALLOWED_HOSTS = [ZIBAL_GATEWAY_HOST] as const;

export const ZIBAL_SUCCESS_RESULT = 100 as const;

export function buildZibalPaymentStartUrl(trackId: string): string {
  return `https://${ZIBAL_GATEWAY_HOST}/start/${encodeURIComponent(trackId)}`;
}
