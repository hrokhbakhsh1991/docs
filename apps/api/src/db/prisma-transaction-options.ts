export type PrismaTransactionOptions = {
  readonly maxWait: number;
  readonly timeout: number;
};

const DEFAULT_MAX_WAIT_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 5_000;
const DEV_MAX_WAIT_MS = 30_000;
const DEV_TIMEOUT_MS = 60_000;

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Prisma interactive TX wait/timeouts — raise for high-latency local dev (VPS SSH tunnel). */
export function resolvePrismaTransactionOptions(
  env: NodeJS.ProcessEnv = process.env
): PrismaTransactionOptions {
  const devDefaults = env.NODE_ENV === "development";
  const maxWait = readPositiveInt(
    env.PRISMA_TRANSACTION_MAX_WAIT_MS?.trim(),
    devDefaults ? DEV_MAX_WAIT_MS : DEFAULT_MAX_WAIT_MS
  );
  const timeout = readPositiveInt(
    env.PRISMA_TRANSACTION_TIMEOUT_MS?.trim(),
    devDefaults ? DEV_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
  );
  return { maxWait, timeout };
}
