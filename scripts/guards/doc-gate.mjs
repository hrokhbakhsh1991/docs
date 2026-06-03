#!/usr/bin/env node
/**
 * Doc-Gate — Docs-as-Code DoD (MIGRATION-MAP §19).
 * documentation-sync + markdoc validate + audit-boundary
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

function runStep(label, command, args) {
  console.log(`\ndoc-gate: ${label}`);
  const r = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
  });
  if (r.status !== 0) {
    console.error(`doc-gate: FAIL at ${label}`);
    process.exit(r.status ?? 1);
  }
}

function checkPullRequestTemplate() {
  const templatePath = path.join(REPO_ROOT, ".github/pull_request_template.md");
  if (!fs.existsSync(templatePath)) {
    console.error("doc-gate: missing .github/pull_request_template.md (§8.2)");
    process.exit(1);
  }
  const body = fs.readFileSync(templatePath, "utf8");
  if (!body.includes("## Exit criteria")) {
    console.error('doc-gate: PR template must include "## Exit criteria" (§8.2)');
    process.exit(1);
  }
  console.log("doc-gate: PR template OK (§8.2)");
}

function main() {
  console.log("doc-gate: starting (Docs-as-Code §19)");

  checkPullRequestTemplate();

  runStep("documentation-sync", "node", [
    path.join(REPO_ROOT, "scripts/guards/documentation-sync.mjs"),
  ]);
  runStep("markdoc-validate", "node", [
    path.join(REPO_ROOT, "scripts/doc/markdoc-validate.mjs"),
  ]);
  runStep("audit-boundary", "node", [
    path.join(REPO_ROOT, "scripts/guards/audit-ui-primitives-boundary.mjs"),
  ]);

  console.log("\ndoc-gate: PASS");
}

main();
