/**
 * Finance recon env/config helpers — kept free of runner imports to avoid cycles.
 * @see TEMP/phases/P0-stabilization-plan.md Step A
 */

const DEFAULT_INTERVAL_MS = 300_000;

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

export function isFinanceReconAutoRepairEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FINANCE_RECON_AUTO_REPAIR?.trim() === "1";
}
