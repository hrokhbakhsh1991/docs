#!/usr/bin/env node
/**
 * Phase 9.1 PR boundary diff — scaffold.
 * @see docs/phase-9/appendices/PHASE-BOUNDARY-MATRIX.yaml
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

const diff = spawnSync("git", ["diff", "--name-only", "HEAD"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});

const changed = (diff.stdout || "")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

const allowPrefixes = [
  "apps/api/src/identity/",
  "apps/api/prisma/",
  "apps/api/test/identity-",
  "apps/web/app/auth/",
  "apps/web/test/auth-",
  "apps/web/src/admin/require-operator-session.ts",
  "infra/sql/005_identity_production_delta.sql",
  "docs/phase-9/",
  "reports/phase-9-",
  "packages/workspace-sdk/src/auth/",
  "packages/workspace-sdk/test/identity-",
  "scripts/guards/phase-9",
  "scripts/guards/lib/phase-9",
  "scripts/guards/p9-boundary-diff.mjs",
  "package.json",
  "pnpm-lock.yaml",
];

const violations = changed.filter((f) => !allowPrefixes.some((p) => f.startsWith(p) || f === p));

if (violations.length > 0 && changed.some((f) => f.startsWith("apps/api/src/identity"))) {
  console.error("FAIL P9-BOUNDARY: files outside 9.1 allowlist:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("guard:p9-boundary-diff PASS (no 9.1 train violation or clean diff)");
