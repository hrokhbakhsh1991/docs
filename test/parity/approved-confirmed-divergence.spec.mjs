import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { BOOKING_STATUSES } from "../../packages/booking-http-contracts/src/booking-status.ts";
import {
  MEMBER_REGISTRATION_DISPLAY_STATUSES,
} from "../../packages/workspace-sdk/src/registration/member-registration-display-status.ts";
import { resolveMemberRegistrationDisplayStatus } from "../../packages/workspace-sdk/src/portal/resolve-member-registration-display-status.ts";
import { assertGoldenParity, fixturePath } from "./lib/golden-harness.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const prismaSchemaPath = join(here, "../../apps/api/prisma/schema.prisma");

function readPortalLegacyBookingStatusLabels() {
  const portalDisplayPath = join(
    here,
    "../../apps/portal/src/me/format-member-registration-display.server.ts"
  );
  const source = readFileSync(portalDisplayPath, "utf8");
  const match = source.match(
    /const BOOKING_STATUSES = \[([\s\S]*?)\] as const/
  );
  assert.ok(match, "portal BOOKING_STATUSES const not found");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((row) => row[1]);
}

function assertSchemaMapsTable(tableName) {
  const schema = readFileSync(prismaSchemaPath, "utf8");
  assert.match(schema, new RegExp(`@@map\\("${tableName}"\\)`));
}

describe("approved vs confirmed divergence contract (CW0-05)", () => {
  it("fixture contract: vocabularies live in different persistence stores", () => {
    assertGoldenParity({
      id: "CW0-05-approved-confirmed-divergence",
      fixturePath: fixturePath(
        "registration-lifecycle/approved-confirmed-divergence.json"
      ),
      run: () => {
        const urbanVocabulary = ["confirmed", "waitlist", "cancelled"];
        const portalWireExcludes = ["confirmed", "waitlist"].filter(
          (status) => !readPortalLegacyBookingStatusLabels().includes(status)
        );
        return {
          bookingPath: {
            persistenceTable: "operator_registrations",
            capacityConsumingStatus: "approved",
            vocabulary: [...BOOKING_STATUSES],
          },
          urbanPath: {
            persistenceTable: "urban_registrations",
            capacityConsumingStatus: "confirmed",
            vocabulary: urbanVocabulary,
          },
          portalDisplaySemantics: [...MEMBER_REGISTRATION_DISPLAY_STATUSES],
          portalWireLabelExcludes: portalWireExcludes,
          portalLabelExcludes: [],
        };
      },
    });
  });

  it("negative: booking vocabulary excludes confirmed; urban vocabulary excludes approved", () => {
    assert.ok(!BOOKING_STATUSES.includes("confirmed"));
    assert.ok(BOOKING_STATUSES.includes("approved"));

    const urbanVocabulary = ["confirmed", "waitlist", "cancelled"];
    assert.ok(!urbanVocabulary.includes("approved"));

    assert.notEqual(
      BOOKING_STATUSES.find((status) => status === "approved"),
      urbanVocabulary.find((status) => status === "confirmed")
    );
  });

  it("CW4-06: codegen maps urban confirmed/waitlist to member display semantics", () => {
    assert.equal(resolveMemberRegistrationDisplayStatus("urban", "confirmed"), "accepted");
    assert.equal(resolveMemberRegistrationDisplayStatus("urban", "waitlist"), "waitlisted");
    assert.equal(resolveMemberRegistrationDisplayStatus("denali", "approved"), "accepted");
    assert.equal(resolveMemberRegistrationDisplayStatus("denali", "pending"), "pending_review");
  });

  it("schema maps operator_registrations and urban_registrations separately", () => {
    assertSchemaMapsTable("operator_registrations");
    assertSchemaMapsTable("urban_registrations");
  });
});
