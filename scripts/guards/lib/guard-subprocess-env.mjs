/**
 * P0-ISO-03 / KS-14 — whitelist env for guard subprocesses.
 * Prevents CI/app secrets (DATABASE_*, JWT_*, INTERNAL_API_KEY, etc.) from reaching pnpm/test children.
 */

/** Keys copied from the parent process (if set) or supplied via overrides. */
export const ALLOWED_GUARD_ENV = [
  "PATH",
  "HOME",
  "USER",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "NODE_ENV",
  "PHASE_0_GUARD_SCOPE",
  "DOC_SYNC_SCOPE",
  "LEGACY_IMPORT_SCAN_SCOPE",
  "DEPCRUISE_MONOREPO_GUARD",
  // pnpm / corepack (when not solely on PATH)
  "PNPM_HOME",
  "PNPM_SCRIPT_SRC_DIR",
  // CI runners (non-secret flags only)
  "CI",
  "GITHUB_ACTIONS",
  "RUNNER_OS",
  // Windows
  "SystemRoot",
  "PATHEXT",
  "COMSPEC",
  "WINDIR",
];

const ALLOWED_SET = new Set(ALLOWED_GUARD_ENV);

/**
 * @param {Record<string, string | undefined>} [overrides]
 * @returns {NodeJS.ProcessEnv}
 */
export function guardSubprocessEnv(overrides = {}) {
  /** @type {NodeJS.ProcessEnv} */
  const env = {};

  for (const key of ALLOWED_GUARD_ENV) {
    const value = Object.prototype.hasOwnProperty.call(overrides, key)
      ? overrides[key]
      : process.env[key];
    if (value !== undefined && value !== "") {
      env[key] = value;
    }
  }

  if (!env.PATH && process.env.PATH) {
    env.PATH = process.env.PATH;
  }

  return env;
}

/**
 * @param {import("node:child_process").SpawnSyncOptions} [options]
 * @param {Record<string, string | undefined>} [envOverrides]
 */
export function withGuardEnv(options = {}, envOverrides = {}) {
  return {
    ...options,
    env: guardSubprocessEnv(envOverrides),
  };
}

export function assertGuardEnvKeyAllowed(key) {
  if (!ALLOWED_SET.has(key)) {
    throw new Error(`guard subprocess env key not whitelisted: ${key}`);
  }
}
