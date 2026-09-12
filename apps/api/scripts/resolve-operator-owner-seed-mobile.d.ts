/**
 * Canonical operator owner mobile for all identity seeds.
 * When OPERATOR_OWNER_MOBILE is set (staging Iran), Denali + operator-smoke
 * tenants share the same user row — both must write identical canonical `09…`.
 */
export declare function resolveOperatorOwnerSeedMobile(): string;
/** Operator-smoke tenant (…014) owner mobile — same canonical key as Denali when env set. */
export declare function resolveOperatorSmokeOwnerSeedMobile(): string;
