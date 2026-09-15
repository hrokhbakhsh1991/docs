/**
 * WALLET-P3A — map wallet BFF/API failures to portal UI states.
 */
import { isWalletHttpErrorCode } from "@app-tour/wallet-http-contracts";

import { classifyMemberProfileBffFailure, readMemberBffErrorCode } from "../classify-member-profile-bff-error";

export type MemberWalletBffFailureKind =
  | "unauthenticated"
  | "unavailable"
  | "workspace_disabled"
  | "module_disabled"
  | "entitlement_denied"
  | "api_error";

const WORKSPACE_DISABLED_CODES = new Set([
  "WALLET_WORKSPACE_UNSUPPORTED",
  "FORBIDDEN_WALLET_MODULE_DISABLED",
]);

const ENTITLEMENT_DENIED_CODES = new Set(["FORBIDDEN_MEMBER_MODULE_WALLET"]);

export function readMemberWalletBffErrorCode(body: unknown): string | undefined {
  return readMemberBffErrorCode(body);
}

export function classifyMemberWalletBffFailure(
  status: number,
  code?: string,
): MemberWalletBffFailureKind {
  const normalized = code?.trim() ?? "";
  if (WORKSPACE_DISABLED_CODES.has(normalized)) {
    return "workspace_disabled";
  }
  if (ENTITLEMENT_DENIED_CODES.has(normalized)) {
    return "entitlement_denied";
  }
  if (isWalletHttpErrorCode(normalized) && status >= 400 && status < 500) {
    return "api_error";
  }
  const sessionKind = classifyMemberProfileBffFailure(status, code);
  if (sessionKind === "unauthenticated") {
    return "unauthenticated";
  }
  return "unavailable";
}
