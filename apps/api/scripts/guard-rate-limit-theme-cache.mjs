#!/usr/bin/env node
/**
 * RL-DOS-01 / DEC-053 — rate limiter must not call admin findUnique directly.
 * @see docs/phase-5/appendices/rate-limiting.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMITER = path.join(ROOT, "src/middleware/tenant-rate-limiter.ts");
const source = fs.readFileSync(LIMITER, "utf8");

const violations = [];

if (source.includes("getPrismaAdmin")) {
  violations.push("tenant-rate-limiter.ts must not import or call getPrismaAdmin");
}
if (!source.includes("resolveTenantThemeJsonById")) {
  violations.push("tenant-rate-limiter.ts must resolve theme via resolveTenantThemeJsonById");
}
if (/tenant\.findUnique/.test(source)) {
  violations.push("tenant-rate-limiter.ts must not call tenant.findUnique");
}

if (violations.length > 0) {
  console.error("guard-rate-limit-theme-cache: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-rate-limit-theme-cache: PASS");
