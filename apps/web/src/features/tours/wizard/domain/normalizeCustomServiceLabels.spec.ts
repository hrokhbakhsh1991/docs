import assert from "node:assert/strict";
import test from "node:test";

import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";
import { buildCreateTourPostBody } from "@/lib/services/tours.service";

import { normalizeCustomServiceLabels } from "./normalizeCustomServiceLabels";

test("normalizeCustomServiceLabels trims and drops empty entries", () => {
  assert.deepEqual(normalizeCustomServiceLabels(["  صبحانه ", "", "نیسان"]), ["صبحانه", "نیسان"]);
  assert.equal(normalizeCustomServiceLabels([]), undefined);
  assert.equal(normalizeCustomServiceLabels(["", "  "]), undefined);
});

test("buildCreateTourPostBody includes customServiceLabels when present", () => {
  const prepared = mapCreateTourDto({
    title: "پیمایش آزمایشی دو روزه تور",
    capacity: 10,
    price: 1_000_000,
    lifecycle_status: "Draft",
    autoAcceptRegistrations: true,
    customServiceLabels: ["صبحانه", "نیسان"],
  });
  const wire = buildCreateTourPostBody(prepared);
  assert.deepEqual(wire.customServiceLabels, ["صبحانه", "نیسان"]);
});
