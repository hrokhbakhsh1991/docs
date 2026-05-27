import assert from "node:assert/strict";
import test from "node:test";

import { CURRENT_DRAFT_SCHEMA_VERSION } from "./draft-snapshot.contract";
import {
  createDefaultDraftMigratorRegistry,
  DENALI_CREATE_DRAFT_KEY,
  migrateDenaliCreateDraftData,
} from "./draft-migrator";

test("migrateDenaliCreateDraftData normalizes incomplete legacy blob", () => {
  const result = migrateDenaliCreateDraftData({}, 1);
  assert.equal(result.toSchemaVersion, CURRENT_DRAFT_SCHEMA_VERSION);
  assert.deepEqual(result.data, { form: {}, currentStepIndex: 0 });
});

test("migrateDenaliCreateDraftData preserves valid fields", () => {
  const result = migrateDenaliCreateDraftData(
    { form: { title: "T" }, currentStepIndex: 2 },
    1,
  );
  assert.deepEqual(result.data.form, { title: "T" });
  assert.equal(result.data.currentStepIndex, 2);
});

test("DraftMigratorRegistry marks upgraded when shape changes", () => {
  const registry = createDefaultDraftMigratorRegistry();
  const { snapshot, upgraded } = registry.migrateEnvelope(DENALI_CREATE_DRAFT_KEY, {
    data: { orphan: true },
    version: 3,
    schemaVersion: 1,
    lastModified: 1000,
  });
  assert.equal(upgraded, true);
  assert.equal(snapshot.version, 3);
  assert.equal(snapshot.schemaVersion, CURRENT_DRAFT_SCHEMA_VERSION);
  assert.equal(snapshot.data.currentStepIndex, 0);
});

test("DraftMigratorRegistry no-op when already current and valid", () => {
  const registry = createDefaultDraftMigratorRegistry();
  const input = {
    data: { form: { title: "ok" }, currentStepIndex: 1 },
    version: 2,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: 2000,
  };
  const { upgraded, snapshot } = registry.migrateEnvelope(DENALI_CREATE_DRAFT_KEY, input);
  assert.equal(upgraded, false);
  assert.deepEqual(snapshot, input);
});
