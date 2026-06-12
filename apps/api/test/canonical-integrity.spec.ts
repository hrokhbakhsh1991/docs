import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { PHASE_32_CANONICAL_STORAGE } from "../src/canonical/canonical-storage.js";

const API_SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

const LEGACY_TABLE_HINTS = [
  /\bworkspace_tour/i,
  /\btour_templates?\b/i,
  /\boutbox_events?\b/i,
  /\bprisma\./i,
  /\$queryRaw\b/,
  /legacy\/apps\/api/,
];

function listTsFiles(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) listTsFiles(p, out);
    else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) out.push(p);
  }
  return out;
}

describe("canonical integrity — POST /tours storage", () => {
  it("only touches surfaces on PHASE_32_CANONICAL_STORAGE allow-list", () => {
    assert.deepEqual([...PHASE_32_CANONICAL_STORAGE], ["in_memory.tour_records", "prisma.tours"]);
  });

  it("POST /tours path has no legacy SQL table or Prisma references", () => {
    const tourPath = join(API_SRC, "tours");
    const canonicalPath = join(API_SRC, "canonical");
    /** Phase 5 atomic write path — Prisma TX + outbox enqueue (ADR-005). */
    const phase5AtomicWriteRel = new Set([
      "canonical/canonical-storage.ts",
      "canonical/atomic-canonical-tour-persist.ts",
      "canonical/assert-tour-capacity-in-tx.ts",
      "canonical/migrate-canonical-denali.service.ts",
      "tours/workspace-tour-write-bindings.generated.ts",
      "tours/workspace-tour-write-dispatch.ts",
    ]);
    const hits: string[] = [];
    for (const file of [...listTsFiles(tourPath), ...listTsFiles(canonicalPath)]) {
      const rel = relative(API_SRC, file);
      const src = readFileSync(file, "utf8");
      for (const pattern of LEGACY_TABLE_HINTS) {
        if (!pattern.test(src)) continue;
        if (phase5AtomicWriteRel.has(rel)) continue;
        hits.push(`${rel}: ${pattern}`);
      }
    }
    assert.deepEqual(hits, []);
  });
});
