#!/usr/bin/env node
/**
 * DEC-109 + DEC-117 — full evolution audit guard rollup (phases 1–4).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Phases 1–3 + meta guards (phase 4 via dedicated rollup). */
const LEGACY_EVOLUTION_STEPS = [
  "guard:deploy-argo-rollouts",
  "guard:deploy-prometheus-adapter",
  "guard:deploy-hpa",
  "guard:deploy-phase5-slo-alerts",
  "guard:migrate-deploy-only",
  "guard:rpo-rto-restore-drill",
  "guard:ci-integrity-extension",
  "phase-5:evolution-phase4-gate",
  "guard:evolution-phase4-gate",
  "guard:outbox-processing-reclaim",
  "guard:outbox-failed-replay",
  "guard:transient-db-error",
  "guard:migration-head-preflight",
  "guard:db-test-reset-prod",
  "guard:shutdown-ingress",
  "guard:openapi-dispatch-parity",
  "guard:redis-rate-limiter-fallback",
  "guard:metrics-prometheus-export",
  "guard:internal-cache-invalidate",
  "guard:jwt-dual-key-verify",
];

let failed = 0;
for (const step of LEGACY_EVOLUTION_STEPS) {
  const r = spawnSync("pnpm", ["run", step], { cwd: ROOT, encoding: "utf8", shell: true });
  if (r.status !== 0) {
    failed += 1;
    process.stderr.write(r.stdout ?? "");
    process.stderr.write(r.stderr ?? "");
  }
}

if (failed > 0) {
  console.error(`phase-5-evolution-gate: FAIL (${failed}/${LEGACY_EVOLUTION_STEPS.length})`);
  process.exit(1);
}
console.log(
  `phase-5-evolution-gate: PASS (${LEGACY_EVOLUTION_STEPS.length}/${LEGACY_EVOLUTION_STEPS.length})`
);
