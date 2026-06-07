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

/** Storage/Prisma bootstrap + Phase 5 data-layer (ADR-005) — not HTTP handlers. */
const STORAGE_LAYER_ALLOWED_REL = [
  "storage/",
  "db/prisma.ts",
  "db/pool-saturation.ts",
  "db/with-canonical-transaction.ts",
  "db/with-tenant-rls.ts",
  "db/with-transient-tx-retry.ts",
  "db/rls-session-vars.ts",
  "db/canonical-transaction-now.ts",
  "db/migration-head-preflight.ts",
  "db/tenant-connection-budget.ts",
  "db/transient-db-error.ts",
  "db/assert-tenant-rls-alignment.ts",
  "db/assert-production-database-integrity.ts",
  "canonical/canonical-storage.ts",
  "canonical/atomic-canonical-tour-persist.ts",
  "canonical/assert-tour-capacity-in-tx.ts",
  "canonical/migrate-canonical-denali.service.ts",
  "outbox/",
  "denali-finance/",
  "audit/",
  "events/processed-domain-event-log.ts",
  "events/tour-created-envelope-guard.ts",
  "http/http-idempotency.ts",
  "internal/provisioning.service.ts",
  "routes/internal/db-pool-hold.ts",
  "routes/internal/tenants.ts",
  "server/graceful-shutdown.ts",
  "middleware/error-interceptor.ts",
  "middleware/tenant-rate-limiter.ts",
  "tenant/resolve-registered-tenant.ts",
  "tenant/tenant-route-lookup.ts",
  "tenant/resolve-tenant-feature-flags.ts",
  "tenant/tenant-id-format.ts",
  "tenant/update-tenant-registry-row.ts",
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
    assert.deepEqual(
      hits,
      [],
      "legacy/SQL/Prisma outside storage/ is forbidden in apps/api handlers"
    );
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
