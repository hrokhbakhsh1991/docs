export class EgressUrlBlockedError extends Error {
  readonly code = "EGRESS_URL_BLOCKED" as const;

  constructor(message = "Outbound URL blocked by egress policy") {
    super(message);
    this.name = "EgressUrlBlockedError";
  }
}

export class EgressHostNotAllowlistedError extends Error {
  readonly code = "EGRESS_HOST_NOT_ALLOWLISTED" as const;

  constructor(message = "Outbound URL host is not on the egress allowlist") {
    super(message);
    this.name = "EgressHostNotAllowlistedError";
  }
}

export function isEgressUrlBlockedError(error: unknown): error is EgressUrlBlockedError {
  return error instanceof EgressUrlBlockedError;
}

export function isEgressHostNotAllowlistedError(
  error: unknown
): error is EgressHostNotAllowlistedError {
  return error instanceof EgressHostNotAllowlistedError;
}
