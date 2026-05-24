import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorkspaceSubnavTab } from "./WorkspaceSubnav";

const TOUR_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

test("resolveWorkspaceSubnavTab: registrations at workspace root", () => {
  assert.equal(resolveWorkspaceSubnavTab(`/tours/${TOUR_ID}/workspace`, TOUR_ID), "registrations");
  assert.equal(resolveWorkspaceSubnavTab(`/tours/${TOUR_ID}/workspace/`, TOUR_ID), "registrations");
});

test("resolveWorkspaceSubnavTab: waitlist and transport segments", () => {
  assert.equal(
    resolveWorkspaceSubnavTab(`/tours/${TOUR_ID}/workspace/waitlist`, TOUR_ID),
    "waitlist",
  );
  assert.equal(
    resolveWorkspaceSubnavTab(`/tours/${TOUR_ID}/workspace/transport`, TOUR_ID),
    "transport",
  );
});
