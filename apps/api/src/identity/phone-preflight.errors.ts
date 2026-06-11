export const AUTH_PHONE_NOT_AUTHORIZED = "AUTH_PHONE_NOT_AUTHORIZED";
export const MOBILE_INVALID = "MOBILE_INVALID";
export const MOBILE_REQUIRED = "MOBILE_REQUIRED";

export class AuthPhoneNotAuthorizedError extends Error {
  readonly code = AUTH_PHONE_NOT_AUTHORIZED;

  constructor() {
    super(AUTH_PHONE_NOT_AUTHORIZED);
    this.name = "AuthPhoneNotAuthorizedError";
  }
}

export class MobileInvalidError extends Error {
  readonly code = MOBILE_INVALID;

  constructor() {
    super(MOBILE_INVALID);
    this.name = "MobileInvalidError";
  }
}

export class MobileRequiredError extends Error {
  readonly code = MOBILE_REQUIRED;

  constructor() {
    super(MOBILE_REQUIRED);
    this.name = "MobileRequiredError";
  }
}
