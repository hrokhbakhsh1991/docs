import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-denali";

import {
  isGlobalBookingsRouteAllowed,
  shouldShowGlobalBookingsNav,
} from "../src/features/bookings/bookings-nav-enablement";

describe("bookings-nav-enablement", () => {
  it("hides global bookings nav for Denali workspace plugin", () => {
    assert.equal(shouldShowGlobalBookingsNav(DENALI_WORKSPACE_PLUGIN_ID), false);
  });

  it("shows global bookings nav for non-Denali plugins", () => {
    assert.equal(shouldShowGlobalBookingsNav("urban"), true);
    assert.equal(shouldShowGlobalBookingsNav("starter"), true);
  });

  it("keeps /bookings route allowed for deep links", () => {
    assert.equal(isGlobalBookingsRouteAllowed(DENALI_WORKSPACE_PLUGIN_ID), true);
  });
});
