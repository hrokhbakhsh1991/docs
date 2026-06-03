#!/usr/bin/env node
/**
 * Doc-Gate — Docs-as-Code DoD (MIGRATION-MAP §19).
 * documentation-sync + markdoc validate + audit-boundary
 */
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

function main() {
  console.log("doc-gate: starting (Docs-as-Code §19)");

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
