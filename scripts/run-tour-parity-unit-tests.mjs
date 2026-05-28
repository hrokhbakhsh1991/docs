#!/usr/bin/env node
/**
 * Phase 7 — runs focused parity unit tests (wizard/API/types).
 * Invoked from CI after static check-tour-rbac-parity.mjs.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function run(cmd, args, cwd = REPO_ROOT) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const suites = [
  {
    label: "@repo/types submit-required",
    cmd: "pnpm",
    args: [
      "--filter",
      "@repo/types",
      "exec",
      "node",
      "--import",
      "tsx",
      "--test",
      "src/tour-profile-submit-required.spec.ts",
    ],
  },
  {
    label: "@repo/shared capability snapshot",
    cmd: "pnpm",
    args: [
      "--filter",
      "@repo/shared",
      "exec",
      "node",
      "--import",
      "tsx",
      "--test",
      "rbac/jwt-capability-snapshot.spec.ts",
    ],
  },
  {
    label: "API RBAC phase 6-8",
    cmd: "pnpm",
    args: [
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
    ],
  },
  {
    label: "API profile required + patch policy",
    cmd: "pnpm",
    args: [
      "--filter",
      "@apps/api",
      "exec",
      "node",
      "--import",
      "tsx",
      "--test",
      "src/modules/tours/utils/assert-profile-required-fields-for-submit.spec.ts",
      "src/modules/tours/utils/tour-patch-field-policy.spec.ts",
      "src/modules/tours/utils/assert-patch-field-policy.spec.ts",
      "src/modules/tours/policies/assert-tour-patch-write-pipeline.spec.ts",
      "src/modules/tours/policies/tours-lifecycle-transitions.spec.ts",
    ],
  },
  {
    label: "Web wizard parity",
    cmd: "pnpm",
    args: [
      "--filter",
      "@apps/web",
      "exec",
      "node",
      "--import",
      "tsx",
      "--test",
      "src/features/tours/wizard/profileRules/submit-required-parity.spec.ts",
      "src/features/tours/wizard/profileRules/edit-required-parity.spec.ts",
      "src/features/tours/wizard/profileRules/parity-with-server.spec.ts",
    ],
  },
];

for (const suite of suites) {
  run(suite.cmd, suite.args);
}

