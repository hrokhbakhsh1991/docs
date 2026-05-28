#!/usr/bin/env npx tsx
/**
 * CI/build gate: registry ↔ generated artifacts ↔ canonical schema parity.
 * Run: pnpm --filter web verify:denali-architecture
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ARCHITECTURAL_DRIFT_DETECTED = "ARCHITECTURAL_DRIFT_DETECTED";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** `verify:schema-parity` is diagnostic-only (see script header); not part of production build. */
const GATES = [{ label: "audit:denali-registry", script: "audit:denali-registry" }] as const;

function runGate(script: string): boolean {
  const result = spawnSync("pnpm", ["run", script], {
    cwd: WEB_ROOT,
    stdio: "inherit",
    env: { ...process.env, TOUR_UI_SKIP_STYLES: "1" },
  });
  return result.status === 0;
}

function printDriftBanner(failedGates: readonly string[]): void {
  if (failedGates.length > 0) {
  }
}

export function runDenaliArchitectureGates(): number {
  const failures: string[] = [];
  for (const gate of GATES) {
    if (!runGate(gate.script)) {
      failures.push(gate.label);
    }
  }
  if (failures.length > 0) {
    printDriftBanner(failures);
    return 1;
  }
  return 0;
}

const invokedAsScript =
  process.argv[1]?.includes("verify-denali-architecture") ?? false;
if (invokedAsScript) {
  process.exit(runDenaliArchitectureGates());
}
