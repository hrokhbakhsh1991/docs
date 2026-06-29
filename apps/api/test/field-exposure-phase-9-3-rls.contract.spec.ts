import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const CONNECTION_SCOPE_INDEX_MIGRATION = join(
  REPO_ROOT,
  "apps/api/prisma/migrations/20260704100000_exposure_intent_connection_scope_index/migration.sql",
);
const REMINDER_RLS_MIGRATION = join(
  REPO_ROOT,
  "apps/api/prisma/migrations/20260704110000_denali_exposure_reminder_activations_rls/migration.sql",
);
const INTENT_REPOSITORY = join(
  REPO_ROOT,
  "apps/api/src/exposure/prisma-exposure-intent.repository.ts",
);
const REMINDER_REPOSITORY = join(
  REPO_ROOT,
  "apps/api/src/exposure/denali-reminder-activation.repository.ts",
);

describe("field exposure phase 9.3 RLS contract", () => {
  it("documents reminder RLS and connection-scope index in field-exposure-system.md", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /Phase 9\.3 — RLS reminder \+ connection-scope index/);
    assert.match(text, /idx_exposure_intents_tenant_connection_scope/);
    assert.match(text, /denali_exposure_reminder_activations_rls/);
    assert.match(text, /field-exposure-phase-9-3-rls\.contract\.spec\.ts/);
  });

  it("adds expression index for scope.connectionId lookups", () => {
    const migration = readFileSync(CONNECTION_SCOPE_INDEX_MIGRATION, "utf8");
    assert.match(migration, /idx_exposure_intents_tenant_connection_scope/);
    assert.match(migration, /scope->>'connectionId'/);
  });

  it("enables tenant RLS on denali_exposure_reminder_activations", () => {
    const migration = readFileSync(REMINDER_RLS_MIGRATION, "utf8");
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /denali_exposure_reminder_activations_tenant_isolation/);
    assert.match(migration, /app\.current_tenant_id/);
    assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE/);
  });

  it("queries connection intents via JSON path filter instead of full-tenant scan", () => {
    const repository = readFileSync(INTENT_REPOSITORY, "utf8");
    assert.match(repository, /path: \["connectionId"\]/);
    assert.doesNotMatch(repository, /\.filter\(\(intent\) => intent\.scope\.connectionId/);
  });

  it("routes reminder activation reads and writes through withTenantRls", () => {
    const repository = readFileSync(REMINDER_REPOSITORY, "utf8");
    assert.match(repository, /withTenantRls/);
    assert.doesNotMatch(repository, /from "\.\.\/db\/prisma"/);
  });
});
