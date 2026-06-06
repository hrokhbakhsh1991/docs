import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  DENALI_CURRENT_CANONICAL_SCHEMA_VERSION,
  DENALI_LEGACY_TRIP_DETAILS_SCHEMA_VERSION,
  LEGACY_TRIP_DETAILS_SOT_ROOT,
  migrateDenaliCanonical,
  wrapLegacyTripDetailsForMigration,
} from "../src/acl/migrateDenaliCanonical";

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures/golden");

describe("migrate-denali-canonical.spec.ts (REQ-P6-017)", () => {
  it("migrates tour-minimal golden trip_details blob to schemaVersion 1", () => {
    const legacy = JSON.parse(
      readFileSync(join(GOLDEN_DIR, "tour-minimal.json"), "utf8")
    ) as Record<string, unknown>;

    const migrated = migrateDenaliCanonical(DENALI_LEGACY_TRIP_DETAILS_SCHEMA_VERSION, legacy);

    assert.equal(migrated.schemaVersion, DENALI_CURRENT_CANONICAL_SCHEMA_VERSION);
    assert.ok(migrated.roots.length > 0);
    assert.equal((migrated.data as Record<string, unknown>).title, "Test");
    assert.equal(
      (migrated.data as Record<string, unknown>)[LEGACY_TRIP_DETAILS_SOT_ROOT],
      undefined
    );
  });

  it("wrapLegacyTripDetailsForMigration uses staging root only", () => {
    const legacy = { basicInfo: { title: "staging" } };
    const envelope = wrapLegacyTripDetailsForMigration(legacy);
    assert.equal(envelope.schemaVersion, DENALI_LEGACY_TRIP_DETAILS_SCHEMA_VERSION);
    assert.deepEqual(envelope.roots, [LEGACY_TRIP_DETAILS_SOT_ROOT]);
  });

  it("migrateDenaliCanonical accepts envelope root payload", () => {
    const legacy = JSON.parse(
      readFileSync(join(GOLDEN_DIR, "tour-minimal.json"), "utf8")
    ) as Record<string, unknown>;
    const envelope = wrapLegacyTripDetailsForMigration(legacy);
    const migrated = migrateDenaliCanonical(
      DENALI_LEGACY_TRIP_DETAILS_SCHEMA_VERSION,
      envelope.data
    );
    assert.equal(migrated.schemaVersion, DENALI_CURRENT_CANONICAL_SCHEMA_VERSION);
    assert.equal(
      (migrated.data as Record<string, unknown>)[LEGACY_TRIP_DETAILS_SOT_ROOT],
      undefined
    );
  });
});
