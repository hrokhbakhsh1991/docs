import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const MIGRATION = join(
  REPO_ROOT,
  "apps/api/prisma/migrations/20260705100000_exposure_intent_legacy_scope_merge/migration.sql",
);
const CONNECTION_SCOPE = join(
  REPO_ROOT,
  "apps/api/src/exposure/connection-exposure-intent-scope.ts",
);
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");

describe("field exposure legacy scope merge contract (9.5b)", () => {
  it("documents Phase 9.5b in field-exposure-system.md", () => {
    const doc = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(doc, /Phase 9\.5b — Legacy scope merge/);
    assert.match(doc, /20260705100000_exposure_intent_legacy_scope_merge/);
    assert.match(doc, /findConnectionExposureIntentForEvent/);
  });

  it("ships SQL migration that promotes connectionId scopes to route scopes", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    assert.match(sql, /NOT \(scope \? 'eventType'\)/);
    assert.match(sql, /jsonb_build_object\(\s*'connectionId'/);
    assert.match(sql, /'eventType', ei\.trigger/);
    assert.match(sql, /DELETE FROM exposure_intents/);
  });

  it("removes runtime legacy scope fallback lookup", () => {
    const scope = readFileSync(CONNECTION_SCOPE, "utf8");
    assert.match(scope, /findConnectionExposureIntentForEvent/);
    assert.doesNotMatch(scope, /scope: \{ connectionId: input\.connectionId \}/);
  });
});
