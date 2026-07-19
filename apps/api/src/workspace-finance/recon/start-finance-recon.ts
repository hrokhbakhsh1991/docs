import { logger } from "../../observability/logger";
import { runFinanceReconJob } from "./finance-recon-runner";

const DEFAULT_INTERVAL_MS = 300_000;

export type FinanceReconHandle = {
  readonly stop: () => void;
};

export function isFinanceReconEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.FINANCE_RECON_ENABLED?.trim().toLowerCase();
  if (raw === "false") {
    return false;
  }
  if (raw === "true") {
    return true;
  }
  return env.STORAGE_DRIVER?.trim() === "prisma" && Boolean(env.DATABASE_URL?.trim());
}

export function readFinanceReconIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.FINANCE_RECON_INTERVAL_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_INTERVAL_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 60_000 ? parsed : DEFAULT_INTERVAL_MS;
}

export function startFinanceReconIfEnabled(
  env: NodeJS.ProcessEnv = process.env
): FinanceReconHandle | null {
  if (!isFinanceReconEnabled(env)) {
    return null;
  }
  const intervalMs = readFinanceReconIntervalMs(env);
  let stopped = false;
  const tick = async (): Promise<void> => {
    if (stopped) {
      return;
    }
    try {
      await runFinanceReconJob({ job: "ALL" });
    } catch (error: unknown) {
      logger.warn(
        {
          event: "finance.recon.tick_failed",
          err: error instanceof Error ? error.message : String(error),
        },
        "finance recon tick failed"
      );
    }
  };
  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref?.();
  void tick();
  logger.info({ event: "finance.recon.started", interval_ms: intervalMs }, "finance recon started");
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
