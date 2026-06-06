export const REQUEST_BODY_TOO_LARGE = "REQUEST_BODY_TOO_LARGE";

const DEFAULT_MAX_BODY_BYTES = 256 * 1024;

export class RequestBodyTooLargeError extends Error {
  readonly code = REQUEST_BODY_TOO_LARGE;

  constructor(public readonly maxBytes: number) {
    super(REQUEST_BODY_TOO_LARGE);
    this.name = "RequestBodyTooLargeError";
  }
}

export function isRequestBodyTooLargeError(error: unknown): error is RequestBodyTooLargeError {
  return error instanceof RequestBodyTooLargeError;
}

export function resolveHttpMaxBodyBytes(): number {
  const raw = process.env.HTTP_MAX_BODY_BYTES?.trim();
  if (!raw) {
    return DEFAULT_MAX_BODY_BYTES;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_BODY_BYTES;
  }
  return parsed;
}
