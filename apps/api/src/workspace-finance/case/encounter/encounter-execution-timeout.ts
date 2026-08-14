/**
 * Encounter execution timeout helpers (PR12-C).
 * Host-only — never invent Case meaning on timeout.
 */

export const FINANCE_CASE_ENCOUNTER_TIMEOUT_MS_ENV = "FINANCE_CASE_ENCOUNTER_TIMEOUT_MS";
export const FINANCE_CASE_ENCOUNTER_GATEWAY_TIMEOUT_MS_ENV =
  "FINANCE_CASE_ENCOUNTER_GATEWAY_TIMEOUT_MS";

export const DEFAULT_ENCOUNTER_TIMEOUT_MS = 2500;
export const DEFAULT_GATEWAY_TIMEOUT_MS = 800;

export class EncounterExecutionTimeoutError extends Error {
  readonly code = "CASE_ENCOUNTER_TIMEOUT" as const;
  constructor(message = "CASE_ENCOUNTER_TIMEOUT") {
    super(message);
    this.name = "EncounterExecutionTimeoutError";
  }
}

export function parseEncounterTimeoutMs(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  key: string,
  fallback: number
): number {
  const raw = env[key];
  if (raw === undefined || raw === null || String(raw).trim().length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function resolveEncounterExecutionTimeoutMs(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): number {
  return parseEncounterTimeoutMs(
    env,
    FINANCE_CASE_ENCOUNTER_TIMEOUT_MS_ENV,
    DEFAULT_ENCOUNTER_TIMEOUT_MS
  );
}

export function resolveEncounterGatewayTimeoutMs(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): number {
  return parseEncounterTimeoutMs(
    env,
    FINANCE_CASE_ENCOUNTER_GATEWAY_TIMEOUT_MS_ENV,
    DEFAULT_GATEWAY_TIMEOUT_MS
  );
}

/**
 * Race a promise against a wall-clock budget.
 * On timeout: reject EncounterExecutionTimeoutError (caller maps to 503 / degraded).
 */
export async function withEncounterTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  options?: { readonly label?: string }
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return work;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(
            new EncounterExecutionTimeoutError(
              options?.label !== undefined
                ? `CASE_ENCOUNTER_TIMEOUT:${options.label}`
                : "CASE_ENCOUNTER_TIMEOUT"
            )
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
