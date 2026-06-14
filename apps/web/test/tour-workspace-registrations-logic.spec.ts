import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTourRegistrationsBookingsQuery,
  buildTourRegistrationsWorkspaceQuery,
} from "../src/features/tours/tour-workspace-registrations-logic";

const TOUR_ID = "805c1407-84fc-405e-bb2e-577f977a5c94";

test("buildTourRegistrationsWorkspaceQuery lists all statuses for tour", () => {
  const query = buildTourRegistrationsWorkspaceQuery(TOUR_ID);
  assert.match(query, /tourId=/);
  assert.match(query, /view=ops/);
  assert.doesNotMatch(query, /status=/);
});

test("buildTourRegistrationsBookingsQuery keeps pending filter for command center", () => {
  const query = buildTourRegistrationsBookingsQuery(TOUR_ID);
  assert.match(query, /status=pending/);
  assert.match(query, new RegExp(`tourId=${TOUR_ID}`));
});
