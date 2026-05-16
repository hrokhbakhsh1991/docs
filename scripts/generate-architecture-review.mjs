#!/usr/bin/env node
/**
 * Phase 17.3 — production readiness architecture review markdown.
 * Output: docs/architecture-review/YYYY-MM-DD.md
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function runCheck(label, scriptName) {
  const scriptPath = path.join(REPO_ROOT, "scripts", scriptName);
  if (!fs.existsSync(scriptPath)) {
    return { label, ok: false, detail: "script missing" };
  }
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return {
    label,
    ok: result.status === 0,
    detail: result.status === 0 ? "pass" : (result.stderr || result.stdout || "failed").slice(0, 200),
  };
}

const date = new Date().toISOString().slice(0, 10);
const checks = [
  runCheck("Tenant / tour gate", "verify-phase-10-gate.mjs"),
  runCheck("Tour RBAC parity", "check-tour-rbac-parity.mjs"),
  runCheck("Capability governance", "check-capability-governance.mjs"),
  runCheck("Tour governance bundle", "run-tour-governance.mjs"),
];

const lines = [
  `# Architecture review — ${date}`,
  "",
  "Auto-generated readiness snapshot (Phase 17.3).",
  "",
  "| Area | Status | Notes |",
  "|------|--------|-------|",
  ...checks.map((c) => `| ${c.label} | ${c.ok ? "PASS" : "FAIL"} | ${c.detail.replace(/\|/g, "/")} |`),
  "",
  "## Coverage areas",
  "",
  "- Tenant safety: `verify-phase-10-gate.mjs`",
  "- RBAC / capability drift: `run-tour-governance.mjs`, `check-capability-governance.mjs`",
  "- API contract parity: `check-tour-rbac-parity.mjs`",
  "- Lifecycle integrity: `tour-lifecycle-governance.ts`",
  "- Observability: `REQUEST_TRACE` middleware + global error envelope",
  "- Env validation: `packages/config/env-validation.ts`",
  "",
];

const outDir = path.join(REPO_ROOT, "docs", "architecture-review");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${date}.md`);
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`[architecture-review] wrote ${outPath}`);

const failed = checks.filter((c) => !c.ok);
process.exit(failed.length > 0 ? 1 : 0);
