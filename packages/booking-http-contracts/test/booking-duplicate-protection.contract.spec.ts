import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BOOKING_ACTIVE_GUEST_PARTIAL_UNIQUES,
  BOOKING_DUPLICATE_PROBE_KINDS,
  BOOKING_DUPLICATE_PROBE_PORT_METHODS,
  BOOKING_GUEST_DUPLICATE_DOMAIN_ERROR,
  isBookingDuplicateProbeKind,
} from "../src/booking-duplicate-protection.contract";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");

describe("booking-duplicate-protection.contract (CW4-07)", () => {
  it("CW4-07-01 frozen probe kinds align with BookingPublicPort surface", () => {
    const portSrc = readFileSync(
      join(here, "../src/booking-public.port.ts"),
      "utf8"
    );
    for (const kind of BOOKING_DUPLICATE_PROBE_KINDS) {
      const method = BOOKING_DUPLICATE_PROBE_PORT_METHODS[kind];
      assert.match(portSrc, new RegExp(`${method}\\(`));
    }
    assert.equal(Object.keys(BOOKING_DUPLICATE_PROBE_PORT_METHODS).length, 5);
  });

  it("CW4-07-02 negative: booking contract does not encode Urban email-only policy", () => {
    const contractSrc = readFileSync(
      join(here, "../src/booking-duplicate-protection.contract.ts"),
      "utf8"
    );
    assert.doesNotMatch(contractSrc, /urban_registrations/i);
    assert.doesNotMatch(contractSrc, /URBAN_REGISTRATION_DUPLICATE/);
    assert.ok(!BOOKING_DUPLICATE_PROBE_KINDS.includes("emailOnly" as never));
    assert.equal(BOOKING_DUPLICATE_PROBE_KINDS.includes("email"), true);
    assert.equal(BOOKING_DUPLICATE_PROBE_KINDS.includes("user"), true);
  });

  it("CW4-07-03 negative: user probe is self-only (host repository contract)", () => {
    const repoSrc = readFileSync(
      join(repoRoot, "apps/api/src/bookings/prisma-bookings.repository.ts"),
      "utf8"
    );
    const fn = repoSrc.slice(repoSrc.indexOf("async findActiveGuestDuplicate"));
    const body = fn.slice(0, fn.indexOf("\n  async getBookingsSummaryStats"));
    assert.match(body, /case "user"/);
    assert.match(body, /registrantTarget/);
    assert.match(body, /equals: "other"/);
  });

  it("CW4-07-04 partial unique index names frozen in contract", () => {
    const names = BOOKING_ACTIVE_GUEST_PARTIAL_UNIQUES.map((row) => row.name);
    assert.deepEqual(names, [
      "uq_operator_reg_active_email",
      "uq_operator_reg_active_self",
      "uq_operator_reg_active_label",
      "uq_operator_reg_active_national_id",
    ]);
    const baseMigrationSql = readFileSync(
      join(
        repoRoot,
        "apps/api/prisma/migrations/20260720150000_operator_registration_active_guest_uniques/migration.sql"
      ),
      "utf8"
    );
    for (const name of [
      "uq_operator_reg_active_email",
      "uq_operator_reg_active_label",
      "uq_operator_reg_active_national_id",
    ]) {
      assert.match(baseMigrationSql, new RegExp(name));
    }
    const selfMigrationSql = readFileSync(
      join(
        repoRoot,
        "apps/api/prisma/migrations/20260810120000_operator_registration_active_self_unique/migration.sql"
      ),
      "utf8"
    );
    assert.match(selfMigrationSql, /uq_operator_reg_active_self/);
    assert.match(selfMigrationSql, /DROP INDEX IF EXISTS uq_operator_reg_active_user/);
  });

  it("CW4-07-05 BOOKING_GUEST_DUPLICATE domain token unchanged", () => {
    assert.equal(BOOKING_GUEST_DUPLICATE_DOMAIN_ERROR, "BOOKING_GUEST_DUPLICATE");
    const interceptor = readFileSync(
      join(repoRoot, "apps/api/src/middleware/error-interceptor.ts"),
      "utf8"
    );
    assert.match(interceptor, /BOOKING_GUEST_DUPLICATE/);
  });

  it("CW4-07-06 isBookingDuplicateProbeKind rejects unknown kinds", () => {
    assert.equal(isBookingDuplicateProbeKind("user"), true);
    assert.equal(isBookingDuplicateProbeKind("email"), true);
    assert.equal(isBookingDuplicateProbeKind("tenantTourEmail"), false);
    assert.equal(isBookingDuplicateProbeKind(""), false);
  });
});
