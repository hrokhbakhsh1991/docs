import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(API_ROOT, "src");

import { PHASE_32_CANONICAL_STORAGE } from "../src/canonical/canonical-storage.js";

const FORBIDDEN_STORAGE_PATTERNS = [
  /\bprisma\b/i,
  /\$queryRaw\b/,
  /\$executeRaw\b/,
  /\bINSERT\s+INTO\b/i,
  /\blegacy\/apps\/api\b/i,
];

/** Storage/Prisma bootstrap files — not handler layers. */
const STORAGE_LAYER_ALLOWED_REL = [
  "storage/",
  "db/prisma.ts",
  "db/with-canonical-transaction.ts",
  "db/with-tenant-rls.ts",
  "canonical/canonical-storage.ts",
];

function listTsFiles(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) listTsFiles(p, out);
    else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) out.push(p);
  }
  return out;
}

describe("Phase 3.2 integrity audit (automated)", () => {
  it("canonical write path uses only declared storage surfaces", () => {
    assert.deepEqual([...PHASE_32_CANONICAL_STORAGE], ["in_memory.tour_records", "prisma.tours"]);
    const hits: string[] = [];
    for (const file of listTsFiles(SRC_DIR)) {
      const rel = relative(SRC_DIR, file);
      const src = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_STORAGE_PATTERNS) {
        if (!pattern.test(src)) continue;
        if (STORAGE_LAYER_ALLOWED_REL.some((p) => rel.startsWith(p))) {
          continue;
        }
        hits.push(`${rel}: ${pattern}`);
      }
    }
    assert.deepEqual(hits, [], "legacy/SQL/Prisma outside storage/ is forbidden in apps/api handlers");
  });

  it("handlers never call storage find* directly (ScopedTourRepository only)", () => {
    const violations: string[] = [];
    for (const file of listTsFiles(SRC_DIR)) {
      const rel = relative(SRC_DIR, file);
      if (rel.startsWith("db/") || rel.startsWith("casl/") || rel.startsWith("storage/")) continue;
      const src = readFileSync(file, "utf8");
      if (
        /tourRepository\.(findMany|findFirst|findById)\s*\(/.test(src) ||
        /storage\.(findMany|findFirst|findById)\s*\(/.test(src)
      ) {
        violations.push(rel);
      }
    }
    assert.deepEqual(violations, []);
  });
});
