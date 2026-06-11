#!/usr/bin/env node
/**
 * Phase 9.1 PR boundary diff — enforces allowed_write_paths from PHASE-BOUNDARY-MATRIX §9.1.
 * @see docs/phase-9/appendices/PHASE-BOUNDARY-MATRIX.md
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const matrixPath = path.join(REPO_ROOT, "docs/phase-9/appendices/PHASE-BOUNDARY-MATRIX.md");

if (!fs.existsSync(matrixPath)) {
  console.error("FAIL P9-BOUNDARY: missing PHASE-BOUNDARY-MATRIX.md");
  process.exit(1);
}

/** Glob `prefix/**` → startsWith(prefix/) or equals prefix; exact paths match literally. */
function globToMatcher(glob) {
  if (glob.endsWith("/**")) {
    const prefix = glob.slice(0, -3);
    return (file) => file === prefix || file.startsWith(`${prefix}/`);
  }
  if (glob.endsWith("*.spec.ts")) {
    const prefix = glob.slice(0, -"*.spec.ts".length);
    return (file) => file.startsWith(prefix) && file.endsWith(".spec.ts");
  }
  return (file) => file === glob;
}

const allowGlobs = [
  "apps/api/src/identity/**",
  "apps/api/prisma/**",
  "apps/api/test/identity-*.spec.ts",
  "apps/api/test/phone-login-authorization.spec.ts",
  "apps/api/test/identity-login-*.spec.ts",
  "apps/api/test/phase-9-persistence.integration.spec.ts",
  "apps/web/app/auth/**",
  "apps/web/app/login/**",
  "apps/web/app/api/auth/**",
  "apps/web/middleware.ts",
  "apps/web/lib/auth/**",
  "apps/web/src/auth/**",
  "apps/web/src/features/auth/**",
  "apps/web/test/auth-*.spec.ts",
  "apps/web/test/operator-login*.spec.ts",
  "apps/web/test/operator-smoke.spec.ts",
  "apps/web/test/otp-segment-input.spec.ts",
  "apps/web/test/resolve-login-error.spec.ts",
  "apps/web/test/login-tenant-brand.spec.ts",
  "apps/web/test/bff-login-rate-limit.spec.ts",
  "apps/web/src/admin/require-operator-session.ts",
  "infra/sql/005_identity_production_delta.sql",
  "packages/workspace-sdk/src/auth/**",
  "packages/workspace-sdk/test/operator-ability.spec.ts",
  "docs/phase-9/**",
  "reports/phase-9-",
  "scripts/guards/phase-9",
  "scripts/guards/lib/phase-9",
  "scripts/guards/p9-boundary-diff.mjs",
  "package.json",
  "pnpm-lock.yaml",
];

const matchers = allowGlobs.map(globToMatcher);

function isAllowed(file) {
  return matchers.some((match) => match(file));
}

const diff = spawnSync("git", ["diff", "--name-only", "HEAD"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});

const changed = (diff.stdout || "")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

const violations = changed.filter((f) => !isAllowed(f));

if (violations.length > 0 && changed.some((f) => f.startsWith("apps/api/src/identity"))) {
  console.error("FAIL P9-BOUNDARY: files outside 9.1 allowlist:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("guard:p9-boundary-diff PASS (no 9.1 train violation or clean diff)");
