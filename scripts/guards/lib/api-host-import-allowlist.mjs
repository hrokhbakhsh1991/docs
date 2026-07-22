/**
 * API host-import legacy allowlist — shared by isolation + ratchet guards.
 * Shrink only: remove entries when codegen/bindings absorb a path.
 * Raising the ceiling requires Architect-approved charter edit
 * (docs/dev/saas-platform-remediation.mdoc Phase A budgets).
 * @see docs/dev/saas-platform-remediation.mdoc
 */

/**
 * Frozen ceiling (Gap Closure). Emptied after audit proved zero remaining
 * workspace package "host" path imports under apps/api/src (Phase A had 22).
 * Current allowlist must be a subset of this set — additions of new paths are forbidden.
 */
export const HOST_IMPORT_LEGACY_ALLOWLIST_CEILING = Object.freeze([]);

/** Max entry count — decrease when shrinking; never increase without charter. */
export const HOST_IMPORT_LEGACY_ALLOWLIST_MAX = 0;

/**
 * Active allowlist (paths relative to apps/api/src).
 * Must remain subset of CEILING and size at most MAX.
 */
export const HOST_IMPORT_LEGACY_ALLOWLIST = new Set(HOST_IMPORT_LEGACY_ALLOWLIST_CEILING);
