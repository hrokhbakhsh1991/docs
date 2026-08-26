/** Shared local identity for the operator smoke server and browser fixtures. */
export const DEFAULT_OPERATOR_SMOKE_OWNER_MOBILE = "09174070937";

export function resolveOperatorSmokeOwnerMobile(env = process.env) {
  const configured = env.OPERATOR_OWNER_MOBILE?.trim();
  return configured !== undefined && configured.length > 0
    ? configured
    : DEFAULT_OPERATOR_SMOKE_OWNER_MOBILE;
}
