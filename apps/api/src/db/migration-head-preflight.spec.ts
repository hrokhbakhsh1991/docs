import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXPECTED_PRISMA_MIGRATION_HEAD,
  assertMigrationHeadMatches,
  formatMigrationHeadMismatch,
} from "./migration-head-preflight";

describe("migration-head-preflight (DEC-097)", () => {
  it("expected head matches latest migration folder", () => {
    assert.equal(EXPECTED_PRISMA_MIGRATION_HEAD, "20260612130000_equipment_theme_ids");
  });

  it("throws on mismatch with structured message", () => {
    assert.throws(
      () => assertMigrationHeadMatches("20260604114237_phase4_schema"),
      /PRODUCTION_MIGRATION_HEAD_MISMATCH:20260612130000_equipment_theme_ids:20260604114237_phase4_schema/
    );
  });

  it("formats missing head as none", () => {
    assert.equal(
      formatMigrationHeadMismatch("expected", undefined),
      "PRODUCTION_MIGRATION_HEAD_MISMATCH:expected:none"
    );
  });
});
