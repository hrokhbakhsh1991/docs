#!/usr/bin/env node
/**
 * DEC-117 — Phase 4 evolution guard rollup (DEC-110…115 + DEC-116 via relay-backoff).
 * @see docs/phase-5/appendices/phase5-evolution-phase4-gate.md
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Ordered Phase 4 evolution static guards — do not reorder without doc update. */
export const PHASE4_EVOLUTION_STEPS = [
  "guard:outbox-auto-retry",
  "guard:relay-backoff",
  "guard:canonical-tx-transient-retry",
  "guard:pool-saturation-retry-after",
  "guard:priority-load-shed",
  "guard:projection-auto-reconcile",
];

let failed = 0;
for (const step of PHASE4_EVOLUTION_STEPS) {
  const r = spawnSync("pnpm", ["run", step], { cwd: ROOT, encoding: "utf8", shell: true });
  if (r.status !== 0) {
    failed += 1;
    process.stderr.write(r.stdout ?? "");
    process.stderr.write(r.stderr ?? "");
  }
}

if (failed > 0) {
  console.error(`phase-5-evolution-phase4-gate: FAIL (${failed}/${PHASE4_EVOLUTION_STEPS.length})`);
  process.exit(1);
}
console.log(
  `phase-5-evolution-phase4-gate: PASS (${PHASE4_EVOLUTION_STEPS.length}/${PHASE4_EVOLUTION_STEPS.length})`
);
