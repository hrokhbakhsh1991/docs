#!/usr/bin/env node
/** PROD-6 R6-20 — static security checks for TS and workflow scripts. */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function tracked(pattern) {
  const r = spawnSync("git", ["ls-files", pattern], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr || "git ls-files failed");
  return r.stdout.trim().split(/\n+/).filter(Boolean).filter((f) => !f.startsWith("legacy/"));
}
const files = [...tracked("*.ts"), ...tracked("*.tsx"), ...tracked("*.mts"), ...tracked("*.cts"), ...tracked("*.mjs"), ...tracked(".github/workflows/*.yml"), ...tracked(".github/workflows/*.yaml")];
const violations = [];
const sensitiveConsoleAllowlist = new Set([
  "apps/api/scripts/bootstrap-dev-jwt-keys.mjs",
  "scripts/ops/secret-scan-history-release.mjs",
]);
for (const file of files) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (
      /console\.log\([^)]*(otp|password|secret|authorization|bearer|private.?key)/i.test(line) &&
      !sensitiveConsoleAllowlist.has(file)
    ) violations.push(`${file}:${i + 1} sensitive console log`);
    if (/catch\s*\([^)]*\)\s*{\s*}/.test(line)) violations.push(`${file}:${i + 1} empty catch block`);
    if (/curl\s+[^|\n]*\|\s*(sh|bash)/.test(line)) violations.push(`${file}:${i + 1} curl pipe shell`);
    if (/StrictHostKeyChecking=no/.test(line) && file !== "scripts/ops/prod6-static-security.mjs")
      violations.push(`${file}:${i + 1} disables SSH host key checking`);
  });
}
if (violations.length) {
  console.error("prod6-static-security: FAIL");
  for (const v of violations.slice(0, 80)) console.error(`  ${v}`);
  if (violations.length > 80) console.error(`  ... ${violations.length - 80} more`);
  process.exit(1);
}
console.log(`prod6-static-security: PASS — files=${files.length}`);
