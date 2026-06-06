export const RESPONSE_TOO_LARGE = "RESPONSE_TOO_LARGE";

/** Default 2 MiB — larger than ingress (256 KiB) to allow full canonical GET payloads. */
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class ResponseTooLargeError extends Error {
  readonly code = RESPONSE_TOO_LARGE;

  constructor(
    public readonly maxBytes: number,
    public readonly actualBytes: number
  ) {
    super(RESPONSE_TOO_LARGE);
    this.name = "ResponseTooLargeError";
  }
}

export function isResponseTooLargeError(error: unknown): error is ResponseTooLargeError {
  return error instanceof ResponseTooLargeError;
}

export function resolveHttpMaxResponseBytes(): number {
  const raw = process.env.HTTP_MAX_RESPONSE_BYTES?.trim();
  if (!raw) {
    return DEFAULT_MAX_RESPONSE_BYTES;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_RESPONSE_BYTES;
  }
  return parsed;
}

export function assertResponsePayloadWithinBudget(payload: string): void {
  const maxBytes = resolveHttpMaxResponseBytes();
  const actualBytes = Buffer.byteLength(payload, "utf8");
  if (actualBytes > maxBytes) {
    throw new ResponseTooLargeError(maxBytes, actualBytes);
  }
}
