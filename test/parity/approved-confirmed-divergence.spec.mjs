import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { BOOKING_STATUSES } from "../../packages/booking-http-contracts/src/booking-status.ts";
import { assertGoldenParity, fixturePath } from "./lib/golden-harness.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const prismaSchemaPath = join(here, "../../apps/api/prisma/schema.prisma");
const portalDisplayPath = join(
  here,
  "../../apps/portal/src/me/format-member-registration-display.server.ts"
);

function readPortalBookingStatusLabels() {
  const source = readFileSync(portalDisplayPath, "utf8");
  const match = source.match(
    /const BOOKING_STATUSES = \[([\s\S]*?)\] as const/
  );
  assert.ok(match, "portal BOOKING_STATUSES const not found");
  const labels = [...match[1].matchAll(/"([^"]+)"/g)].map((row) => row[1]);
  return labels;
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
        const portalLabels = readPortalBookingStatusLabels();
        return {
          bookingPath: {
            persistenceTable: "operator_registrations",
            capacityConsumingStatus: "approved",
            vocabulary: [...BOOKING_STATUSES],
          },
          urbanPath: {
            persistenceTable: "urban_registrations",
            capacityConsumingStatus: "confirmed",
            vocabulary: ["confirmed", "waitlist", "cancelled"],
          },
          portalLabelStatuses: portalLabels,
          portalLabelExcludes: ["confirmed", "waitlist"].filter(
            (status) => !portalLabels.includes(status)
          ),
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

  it("negative: portal member label map excludes confirmed (raw fallback only)", () => {
    const portalLabels = readPortalBookingStatusLabels();
    assert.ok(!portalLabels.includes("confirmed"));
    assert.ok(!portalLabels.includes("waitlist"));
    assert.deepEqual(portalLabels, [
      "pending",
      "approved",
      "waitlisted",
      "rejected",
      "cancelled",
    ]);
  });

  it("schema maps operator_registrations and urban_registrations separately", () => {
    assertSchemaMapsTable("operator_registrations");
    assertSchemaMapsTable("urban_registrations");
  });
});
