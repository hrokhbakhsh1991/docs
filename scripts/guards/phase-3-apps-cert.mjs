#!/usr/bin/env node
/**
 * Phase 3 — application certification (apps/sdk/starter).
 * Static foundation checks live in phase-3-guard.mjs.
 * Full release path: pnpm run phase-3:gate (guard + apps-cert).
 *
 * Usage: node scripts/guards/phase-3-apps-cert.mjs
 * Env: PHASE_3_APPS_CERT_REPORT=2026-08-01 (optional report date slug)
 */
import {
  WORKSPACE_SDK_TEST_MIN,
  WORKSPACE_STARTER_TEST_MIN,
} from "./gate-thresholds.mjs";
import {
  checkCommand,
  checkPackageTests,
  writePhase3Report,
} from "./lib/phase-3-check-helpers.mjs";

const REPORT_DATE =
  process.env.PHASE_3_APPS_CERT_REPORT ??
  process.env.PHASE_3_GATE_REPORT ??
  new Date().toISOString().slice(0, 10);

const MIN_WORKSPACE_SDK_TESTS = WORKSPACE_SDK_TEST_MIN.phase3;
const MIN_STARTER_TESTS = WORKSPACE_STARTER_TEST_MIN.phase3;

function main() {
  const checks = [
    checkCommand(
      "p3_apps_web_lint",
      "P3-E-APP-HOOK",
      "pnpm --filter @apps/web run lint (prelint guards)",
      ["--filter", "@apps/web", "run", "lint"],
    ),
    checkPackageTests(
      "@app-tour/workspace-sdk",
      MIN_WORKSPACE_SDK_TESTS,
      "p3_workspace_sdk_tests",
      "P3-E-CASL-01",
      `workspace-sdk tests ≥ ${MIN_WORKSPACE_SDK_TESTS}`,
    ),
    checkCommand(
      "p3_starter_build",
      "P3-E-WS-01",
      "pnpm --filter @app-tour/workspace-starter run build",
      ["--filter", "@app-tour/workspace-starter", "run", "build"],
    ),
    checkPackageTests(
      "@app-tour/workspace-starter",
      MIN_STARTER_TESTS,
      "p3_starter_tests",
      "P3-E-WS-01",
      `workspace-starter tests ≥ ${MIN_STARTER_TESTS}`,
    ),
    checkCommand(
      "p3_api_gate",
      "P3-E-DB-01",
      "pnpm --filter @apps/api run phase-3:api-gate",
      ["--filter", "@apps/api", "run", "phase-3:api-gate"],
    ),
    checkCommand(
      "p3_web_gate",
      "P3-E-APP-HOOK",
      "pnpm --filter @apps/web run phase-3:web-gate",
      ["--filter", "@apps/web", "run", "phase-3:web-gate"],
    ),
  ];

  writePhase3Report({
    baseName: `phase-3-apps-cert-${REPORT_DATE}`,
    phase: "3.5-apps-cert",
    reportDate: REPORT_DATE,
    gateCommand: "pnpm run phase-3:apps-cert",
    doc: "docs/phase-3/phase-3-guard-apps-cert-split.mdoc",
    note: "Phase 3 apps certification — web lint, sdk/starter suites, api+web phase-3 gates",
    logPrefix: "phase-3-apps-cert",
    checks,
  });
}

main();
