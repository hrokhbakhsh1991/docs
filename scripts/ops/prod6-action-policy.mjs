#!/usr/bin/env node
/** PROD-6 R6-21 — GitHub Actions dependency policy guard. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const workflows = join(root, ".github/workflows");
const allowed = new Set([
  "actions/checkout@v4",
  "actions/setup-node@v4",
  "actions/upload-artifact@v4",
  "pnpm/action-setup@v4",
]);
const violations = [];
let usesCount = 0;
for (const file of readdirSync(workflows).filter((f) => /\.ya?ml$/.test(f))) {
  const rel = `.github/workflows/${file}`;
  const text = readFileSync(join(workflows, file), "utf8");
  for (const [idx, line] of text.split(/\r?\n/).entries()) {
    const m = line.match(/^\s*uses:\s*([^\s#]+)/);
    if (!m) continue;
    usesCount += 1;
    const spec = m[1].replace(/^['"]|['"]$/g, "");
    if (spec.startsWith("./")) continue;
    if (/@[0-9a-f]{40}$/i.test(spec)) continue;
    if (allowed.has(spec)) continue;
    violations.push(`${rel}:${idx + 1} unapproved action ref ${spec}`);
  }
}
if (violations.length) {
  console.error("prod6-action-policy: FAIL");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`prod6-action-policy: PASS — uses=${usesCount} policy=sha-or-approved-major allowlist=${allowed.size}`);
