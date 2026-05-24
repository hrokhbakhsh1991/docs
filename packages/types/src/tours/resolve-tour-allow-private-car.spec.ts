import assert from "node:assert/strict";
import test from "node:test";

import { resolveTourAllowPrivateCar } from "./resolve-tour-allow-private-car";

test("resolveTourAllowPrivateCar: train-only tour returns false", () => {
  assert.equal(
    resolveTourAllowPrivateCar({
      transportModes: ["train"],
      details: { tripDetails: { logistics: { primaryTransportMode: "train" } } },
    }),
    false,
  );
});

test("resolveTourAllowPrivateCar: bus with allowPersonalCar returns true", () => {
  assert.equal(
    resolveTourAllowPrivateCar({
      transportModes: ["bus"],
      details: {
        tripDetails: {
          transport: { allowPersonalCar: true },
          logistics: { primaryTransportMode: "bus" },
        },
      },
    }),
    true,
  );
});

test("resolveTourAllowPrivateCar: private_car in transportModes returns true", () => {
  assert.equal(
    resolveTourAllowPrivateCar({
      transportModes: ["bus", "private_car"],
    }),
    true,
  );
});

test("resolveTourAllowPrivateCar: primaryTransportMode private_car returns true", () => {
  assert.equal(
    resolveTourAllowPrivateCar({
      transportModes: [],
      details: { tripDetails: { logistics: { primaryTransportMode: "private_car" } } },
    }),
    true,
  );
});
