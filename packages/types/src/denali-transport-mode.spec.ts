import assert from "node:assert/strict";
import test from "node:test";

import {
  denaliPrimaryTransportSubmitValue,
  inferDenaliTransportModeFromApiLogistics,
  migrateLegacyDenaliTransportForm,
  normalizeDenaliTransportForm,
} from "./denali-transport-mode";

test("migrateLegacyDenaliTransportForm: bus without private car → bus", () => {
  const out = migrateLegacyDenaliTransportForm({
    primaryTransportMode: "bus",
    privateCarAllowed: false,
  });
  assert.equal(out.transportMode, "bus");
  assert.equal(out.allowPersonalCar, undefined);
  assert.equal(out.dongAmount, undefined);
});

test("migrateLegacyDenaliTransportForm: bus with private car → allowPersonalCar + dong", () => {
  const out = migrateLegacyDenaliTransportForm({
    primaryTransportMode: "bus",
    privateCarAllowed: true,
    dongAmountPerSeat: 150_000,
  });
  assert.equal(out.transportMode, "bus");
  assert.equal(out.allowPersonalCar, true);
  assert.equal(out.dongAmount, 150_000);
});

test("migrateLegacyDenaliTransportForm: van + car share → shared_cars + dong", () => {
  const out = migrateLegacyDenaliTransportForm({
    primaryTransportMode: "van",
    privateCarAllowed: true,
    privateCarMode: "car_share_fixed_dong",
    dongAmountPerSeat: 150_000,
  });
  assert.equal(out.transportMode, "shared_cars");
  assert.equal(out.dongAmount, 150_000);
});

test("normalizeDenaliTransportForm keeps new shape", () => {
  const out = normalizeDenaliTransportForm({
    transportMode: "none",
    transportNotes: "  ",
  });
  assert.equal(out.transportMode, "none");
});

test("inferDenaliTransportModeFromApiLogistics: bus + private_car → bus + allowPersonalCar", () => {
  const out = inferDenaliTransportModeFromApiLogistics({
    primaryTransportMode: "bus",
    rootTransportModes: ["bus", "private_car"],
    fuelShareToman: 80_000,
  });
  assert.equal(out.transportMode, "bus");
  assert.equal(out.allowPersonalCar, true);
  assert.equal(out.dongAmount, 80_000);
});

test("denaliPrimaryTransportSubmitValue: none mode satisfies submit gate", () => {
  assert.equal(
    denaliPrimaryTransportSubmitValue({
      denaliTransportMode: "none",
      primaryTransportMode: undefined,
      rootTransportModes: [],
    }),
    "none",
  );
  assert.equal(
    denaliPrimaryTransportSubmitValue({
      primaryTransportMode: undefined,
      rootTransportModes: [],
    }),
    "none",
  );
  assert.equal(
    denaliPrimaryTransportSubmitValue({
      primaryTransportMode: "bus",
      rootTransportModes: ["bus"],
    }),
    "bus",
  );
});
