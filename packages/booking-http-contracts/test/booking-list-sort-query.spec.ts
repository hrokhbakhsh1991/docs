import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseBookingsListQuery,
  parseBookingsListStatusParam,
} from "../src/booking-request.parsers.ts";

describe("booking-list-sort-query.spec.ts — P3b-a", () => {
  it("defaults sort omitted", () => {
    const query = parseBookingsListQuery(new URL("http://x/bookings?view=ops"));
    assert.equal(query.sort, undefined);
  });

  it("parses sort=departureAt and submittedAt", () => {
    assert.equal(
      parseBookingsListQuery(new URL("http://x/bookings?sort=departureAt")).sort,
      "departureAt"
    );
    assert.equal(
      parseBookingsListQuery(new URL("http://x/bookings?sort=submittedAt")).sort,
      "submittedAt"
    );
    assert.equal(parseBookingsListQuery(new URL("http://x/bookings?sort=nope")).sort, undefined);
  });
});

describe("booking-list-status-query — UX-BKG-43a / 43b", () => {
  it("parses single status and comma IN set", () => {
    assert.deepEqual(parseBookingsListStatusParam("pending"), {
      status: "pending",
      statuses: ["pending"],
    });
    assert.deepEqual(parseBookingsListStatusParam("waitlisted,pending"), {
      statuses: ["pending", "waitlisted"],
    });
    assert.deepEqual(parseBookingsListStatusParam("pending,waitlisted"), {
      statuses: ["pending", "waitlisted"],
    });
    assert.deepEqual(parseBookingsListStatusParam("nope"), {});
    assert.deepEqual(parseBookingsListStatusParam("pending,"), {});

    const query = parseBookingsListQuery(
      new URL("http://x/bookings?view=ops&status=pending,waitlisted")
    );
    assert.deepEqual(query.statuses, ["pending", "waitlisted"]);
    assert.equal(query.status, undefined);
  });

  it("parses approvedWithinDays", () => {
    const query = parseBookingsListQuery(
      new URL("http://x/bookings?view=ops&status=approved&approvedWithinDays=1")
    );
    assert.equal(query.status, "approved");
    assert.equal(query.approvedWithinDays, 1);
    assert.equal(
      parseBookingsListQuery(new URL("http://x/bookings?approvedWithinDays=99")).approvedWithinDays,
      undefined
    );
  });
});
