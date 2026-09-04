import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXPECTED_PRISMA_MIGRATION_HEAD,
  assertMigrationChecksumsMatch,
  assertMigrationHeadMatches,
  formatMigrationChecksumMismatch,
  formatMigrationHeadMismatch,
} from "./migration-head-preflight";

describe("migration-head-preflight (DEC-097 / MR-P0-003)", () => {
  it("expected head matches tip migration folder (ticketing_k1_search_reports_settings)", () => {
    assert.equal(
      EXPECTED_PRISMA_MIGRATION_HEAD,
      "20260904180000_ticketing_k1_search_reports_settings"
    );
  });

  it("throws on mismatch with structured message", () => {
    assert.throws(
      () => assertMigrationHeadMatches("20260604114237_phase4_schema"),
      new RegExp(
        `PRODUCTION_MIGRATION_HEAD_MISMATCH:${EXPECTED_PRISMA_MIGRATION_HEAD}:20260604114237_phase4_schema`
      )
    );
  });

  it("throws when actual is ahead of embedded constant", () => {
    assert.throws(
      () => assertMigrationHeadMatches("20991231120000_future_migration"),
      /PRODUCTION_MIGRATION_HEAD_MISMATCH/
    );
  });

  it("formats missing head as none", () => {
    assert.equal(
      formatMigrationHeadMismatch("expected", undefined),
      "PRODUCTION_MIGRATION_HEAD_MISMATCH:expected:none"
    );
  });

  it("accepts matching migration checksums", () => {
    assert.doesNotThrow(() =>
      assertMigrationChecksumsMatch(
        [{ migration_name: "20260101000000_example", checksum: "abc123" }],
        [{ migration_name: "20260101000000_example", checksum: "abc123" }]
      )
    );
  });

  it("throws on checksum drift with structured message", () => {
    assert.throws(
      () =>
        assertMigrationChecksumsMatch(
          [{ migration_name: "20260101000000_example", checksum: "old" }],
          [{ migration_name: "20260101000000_example", checksum: "new" }]
        ),
      /PRODUCTION_MIGRATION_CHECKSUM_MISMATCH:20260101000000_example:new:old/
    );
  });

  it("throws on missing local or missing DB migration rows", () => {
    assert.equal(
      formatMigrationChecksumMismatch("missing-local", undefined, "db"),
      "PRODUCTION_MIGRATION_CHECKSUM_MISMATCH:missing-local:missing_local:db"
    );
    assert.equal(
      formatMigrationChecksumMismatch("missing-db", "local", undefined),
      "PRODUCTION_MIGRATION_CHECKSUM_MISMATCH:missing-db:local:missing_db"
    );
  });
});
