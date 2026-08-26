/**
 * Booking list member avatar enrichment (ops list projection).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("enrich-booking-list-member-avatars", () => {
  it("API-OPUI-01 listBookings wires avatar enrichment helper", () => {
    const service = readFileSync(
      resolve(API_ROOT, "src/bookings/bookings.service.ts"),
      "utf8"
    );
    const helper = readFileSync(
      resolve(API_ROOT, "src/bookings/enrich-booking-list-member-avatars.ts"),
      "utf8"
    );
    assert.match(service, /enrichBookingListItemsWithMemberAvatars/);
    assert.match(helper, /memberUserId/);
    assert.match(helper, /memberAvatarUrl/);
    assert.match(helper, /findMembershipsByUserIds/);
  });
});
