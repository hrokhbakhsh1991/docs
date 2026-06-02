import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDestinationRegionInRegionalScope,
  assertTourVisibleInRegionalScope,
  tourDestinationRegionId,
} from "./apply-regional-tour-list-scope";
import type { TourEntity } from "../entities/tour.entity";

test("assertTourVisibleInRegionalScope allows all when not restricted", () => {
  const tour = {
    destination: { region: { id: "r-other" } },
  } as TourEntity;
  assert.equal(
    assertTourVisibleInRegionalScope(tour, { restrictToRegions: false, allowedRegionIds: [] }),
    true,
  );
});

test("assertTourVisibleInRegionalScope requires destination region in allow-list", () => {
  const tour = {
    destination: { region: { id: "r1" }, regionId: "r1" },
  } as TourEntity;
  assert.equal(tourDestinationRegionId(tour), "r1");
  assert.equal(
    assertTourVisibleInRegionalScope(tour, {
      restrictToRegions: true,
      allowedRegionIds: ["r1"],
    }),
    true,
  );
  assert.equal(
    assertTourVisibleInRegionalScope(tour, {
      restrictToRegions: true,
      allowedRegionIds: ["r2"],
    }),
    false,
  );
});

test("assertDestinationRegionInRegionalScope enforces allow-list on PATCH destination", () => {
  assert.equal(
    assertDestinationRegionInRegionalScope("r1", {
      restrictToRegions: true,
      allowedRegionIds: ["r1"],
    }),
    true,
  );
  assert.equal(
    assertDestinationRegionInRegionalScope("r2", {
      restrictToRegions: true,
      allowedRegionIds: ["r1"],
    }),
    false,
  );
});
