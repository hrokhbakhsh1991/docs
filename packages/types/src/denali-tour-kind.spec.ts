import assert from "node:assert/strict";
import test from "node:test";

import {
  denaliTourKindToIsMultiDay,
  isDenaliEventTourKind,
  isDenaliTourKind,
} from "./denali-tour-kind";

test("isDenaliTourKind accepts all 8 slugs", () => {
  assert.equal(isDenaliTourKind("mountain_day"), true);
  assert.equal(isDenaliTourKind("event_cinema"), true);
  assert.equal(isDenaliTourKind("city"), false);
});

test("denaliTourKindToIsMultiDay", () => {
  assert.equal(denaliTourKindToIsMultiDay("nature_multi"), true);
  assert.equal(denaliTourKindToIsMultiDay("desert_day"), false);
});

test("isDenaliEventTourKind", () => {
  assert.equal(isDenaliEventTourKind("event_reading"), true);
  assert.equal(isDenaliEventTourKind("mountain_multi"), false);
});
