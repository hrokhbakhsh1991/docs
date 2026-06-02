import assert from "node:assert/strict";
import test from "node:test";

import {
  isDraftEngineFacadeEnabled,
  isDraftEngineV2Enabled,
  shouldPersistDraftSchemaMigrationOnRead,
} from "./draft-engine-feature-flags";

test("isDraftEngineFacadeEnabled defaults to true when unset", () => {
  const prev = process.env.DRAFT_ENGINE_FACADE_ENABLED;
  delete process.env.DRAFT_ENGINE_FACADE_ENABLED;
  try {
    assert.equal(isDraftEngineFacadeEnabled(), true);
  } finally {
    if (prev !== undefined) {
      process.env.DRAFT_ENGINE_FACADE_ENABLED = prev;
    }
  }
});

test("isDraftEngineFacadeEnabled respects explicit off", () => {
  const prev = process.env.DRAFT_ENGINE_FACADE_ENABLED;
  process.env.DRAFT_ENGINE_FACADE_ENABLED = "0";
  try {
    assert.equal(isDraftEngineFacadeEnabled(), false);
  } finally {
    if (prev !== undefined) {
      process.env.DRAFT_ENGINE_FACADE_ENABLED = prev;
    } else {
      delete process.env.DRAFT_ENGINE_FACADE_ENABLED;
    }
  }
});

test("isDraftEngineV2Enabled reads DRAFT_ENGINE_V2_ENABLED when set", () => {
  const prevV2 = process.env.DRAFT_ENGINE_V2_ENABLED;
  const prevFacade = process.env.DRAFT_ENGINE_FACADE_ENABLED;
  process.env.DRAFT_ENGINE_V2_ENABLED = "0";
  process.env.DRAFT_ENGINE_FACADE_ENABLED = "1";
  try {
    assert.equal(isDraftEngineV2Enabled(), false);
    assert.equal(isDraftEngineFacadeEnabled(), false);
  } finally {
    if (prevV2 !== undefined) {
      process.env.DRAFT_ENGINE_V2_ENABLED = prevV2;
    } else {
      delete process.env.DRAFT_ENGINE_V2_ENABLED;
    }
    if (prevFacade !== undefined) {
      process.env.DRAFT_ENGINE_FACADE_ENABLED = prevFacade;
    } else {
      delete process.env.DRAFT_ENGINE_FACADE_ENABLED;
    }
  }
});

test("shouldPersistDraftSchemaMigrationOnRead defaults to false", () => {
  const prev = process.env.DRAFT_ENGINE_PERSIST_SCHEMA_MIGRATION_ON_READ;
  delete process.env.DRAFT_ENGINE_PERSIST_SCHEMA_MIGRATION_ON_READ;
  try {
    assert.equal(shouldPersistDraftSchemaMigrationOnRead(), false);
  } finally {
    if (prev !== undefined) {
      process.env.DRAFT_ENGINE_PERSIST_SCHEMA_MIGRATION_ON_READ = prev;
    }
  }
});
