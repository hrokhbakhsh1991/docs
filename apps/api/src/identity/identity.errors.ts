export const IDENTITY_REQUIRED = "IDENTITY_REQUIRED";
export const OTP_INVALID = "OTP_INVALID";
export const OTP_EXPIRED = "OTP_EXPIRED";
export const OTP_CHALLENGE_INVALID = "OTP_CHALLENGE_INVALID";
export const AUTH_TOKEN_REVOKED = "AUTH_TOKEN_REVOKED";

export class IdentityRequiredError extends Error {
  readonly code = IDENTITY_REQUIRED;

  constructor() {
    super(IDENTITY_REQUIRED);
    this.name = "IdentityRequiredError";
  }
}

export class OtpInvalidError extends Error {
  readonly code = OTP_INVALID;

  constructor(message = OTP_INVALID) {
    super(message);
    this.name = "OtpInvalidError";
  }
}

export class OtpExpiredError extends Error {
  readonly code = OTP_EXPIRED;

  constructor(message = OTP_EXPIRED) {
    super(message);
    this.name = "OtpExpiredError";
  }
}

export class OtpChallengeInvalidError extends Error {
  readonly code = OTP_CHALLENGE_INVALID;

  constructor(message = OTP_CHALLENGE_INVALID) {
    super(message);
    this.name = "OtpChallengeInvalidError";
  }
}

export class AuthTokenRevokedError extends Error {
  readonly code = AUTH_TOKEN_REVOKED;

  constructor() {
    super(AUTH_TOKEN_REVOKED);
    this.name = "AuthTokenRevokedError";
  }
}

export function isIdentityRequiredError(error: unknown): error is IdentityRequiredError {
  return error instanceof IdentityRequiredError;
}

export function isOtpInvalidError(error: unknown): error is OtpInvalidError {
  return error instanceof OtpInvalidError;
}

export function isAuthTokenRevokedError(error: unknown): error is AuthTokenRevokedError {
  return error instanceof AuthTokenRevokedError;
}
