import {
  OPERATOR_LOGIN_ACCESS_QUERY,
  OPERATOR_LOGIN_COPY,
} from "./operator-login-copy";

export function shouldShowInviteOnlyBanner(searchParams: URLSearchParams): boolean {
  return searchParams.get("access") === OPERATOR_LOGIN_ACCESS_QUERY.inviteOnly;
}

export function shouldShowOwnerOnlyBanner(searchParams: URLSearchParams): boolean {
  return searchParams.get("access") === OPERATOR_LOGIN_ACCESS_QUERY.ownerOnly;
}

export function shouldShowOwnershipTransferredBanner(searchParams: URLSearchParams): boolean {
  return searchParams.get("access") === OPERATOR_LOGIN_ACCESS_QUERY.ownershipTransferred;
}

export function resolveNoMembershipLoginMessageKey(): string {
  return OPERATOR_LOGIN_COPY.noMembershipError;
}

export function buildRegisterRedirectTarget(): string {
  return `/auth/login?access=${OPERATOR_LOGIN_ACCESS_QUERY.inviteOnly}`;
}
