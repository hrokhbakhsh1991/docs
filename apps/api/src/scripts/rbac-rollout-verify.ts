/**
 * Runs incremental RBAC/tour governance checks from prompt.md §3.
 *
 *   pnpm --filter @apps/api rbac-rollout:verify
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { emitScriptInfo } from "./script-log";

/** Monorepo root (`apps/api/src/scripts` → four levels up). */
const REPO_ROOT = path.resolve(__dirname, "../../../..");

function run(label: string, cmd: string, args: string[]): void {
  emitScriptInfo(`\n[rbac-rollout-verify] ${label}`);
  const result = spawnSync(cmd, args, { cwd: REPO_ROOT, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status ?? "unknown"})`);
  }
}

async function runChecks(): Promise<void> {
  run("Tour governance (parity + audit + unit tests)", "node", [
    "scripts/run-tour-governance.mjs",
    "--tests",
  ]);

  run("API RBAC unit slice", "pnpm", [
    "--filter",
    "@apps/api",
    "exec",
    "node",
    "--import",
    "tsx",
    "--test",
    "src/common/rbac/assert-capability-assignable.spec.ts",
    "src/common/casl/evaluate-require-capabilities.spec.ts",
    "src/modules/tours/policies/assert-sensitive-trip-details-patch.spec.ts",
    "src/modules/tours/utils/apply-regional-tour-list-scope.spec.ts",
    "src/modules/auth/auth-ability-context.service.spec.ts",
  ]);

  emitScriptInfo("\n[rbac-rollout-verify] All automated checks passed.");
  emitScriptInfo("Manual: login as ws1/ws2/ws3 users, exercise PATCH tours, settings/modules, user capabilities UI.");
}

runChecks().catch((error: unknown) => {
  console.error("rbac-rollout-verify failed:", error);
  process.exit(1);
});
