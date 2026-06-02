import assert from "node:assert/strict";
import test from "node:test";

import { patchDenaliTransportForMode } from "./patchDenaliTransportForMode";

test("patchDenaliTransportForMode clears cost for non-organized modes", () => {
  const patched = patchDenaliTransportForMode(
    { mode: "bus", transportCost: 100_000, allowPersonalCar: true, dongAmount: 50_000 },
    "none",
  );
  assert.equal(patched.mode, "none");
  assert.equal(patched.transportCost, undefined);
  assert.equal(patched.allowPersonalCar, undefined);
  assert.equal(patched.dongAmount, undefined);
});

test("patchDenaliTransportForMode keeps dong when personal car allowed on bus", () => {
  const patched = patchDenaliTransportForMode(
    { mode: "bus", transportCost: 100_000, allowPersonalCar: true, dongAmount: 50_000 },
    "bus",
  );
  assert.equal(patched.transportCost, 100_000);
  assert.equal(patched.dongAmount, 50_000);
});
