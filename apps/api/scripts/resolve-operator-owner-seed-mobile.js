import { canonicalizeLoginMobile } from "../src/identity/canonicalize-login-mobile.js";
import { OPERATOR_SMOKE } from "../test/fixtures/operator-smoke-e2e-tenant.js";
import { DENALI_DEV_OWNER_MOBILE } from "./seed-denali-operator-identity.js";
/**
 * Canonical operator owner mobile for all identity seeds.
 * When OPERATOR_OWNER_MOBILE is set (staging Iran), Denali + operator-smoke
 * tenants share the same user row — both must write identical canonical `09…`.
 */
export function resolveOperatorOwnerSeedMobile() {
    const configured = process.env.OPERATOR_OWNER_MOBILE?.trim();
    const raw = configured && configured.length > 0 ? configured : DENALI_DEV_OWNER_MOBILE;
    return canonicalizeLoginMobile(raw);
}
/** Operator-smoke tenant (…014) owner mobile — same canonical key as Denali when env set. */
export function resolveOperatorSmokeOwnerSeedMobile() {
    const configured = process.env.OPERATOR_OWNER_MOBILE?.trim();
    if (configured && configured.length > 0) {
        return canonicalizeLoginMobile(configured);
    }
    return canonicalizeLoginMobile(OPERATOR_SMOKE.ownerMobile);
}
