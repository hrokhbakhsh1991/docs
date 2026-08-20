import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXPECTED_PRISMA_MIGRATION_HEAD,
  assertMigrationHeadMatches,
  formatMigrationHeadMismatch,
} from "./migration-head-preflight";

describe("migration-head-preflight (DEC-097 / MR-P0-003)", () => {
  it("expected head matches tip migration folder (commercial_quote_member_discount)", () => {
    assert.equal(
      EXPECTED_PRISMA_MIGRATION_HEAD,
      "20260820150000_finance_commercial_quote_member_discount"
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
});
