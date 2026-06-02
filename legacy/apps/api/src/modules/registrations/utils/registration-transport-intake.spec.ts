import assert from "node:assert/strict";
import test from "node:test";

import { RegistrationTransportModeDto } from "../dto/create-registration.dto";
import {
  buildTransportIntakeForMetadata,
  participantMetadataRecordForPersistence,
} from "./registration-transport-intake";

test("buildTransportIntakeForMetadata: driver includes plate", () => {
  assert.deepEqual(
    buildTransportIntakeForMetadata({
      transportMode: RegistrationTransportModeDto.SELF_VEHICLE,
      isDriver: true,
      plateNumber: "12ج34567",
    }),
    { isDriver: true, plateNumber: "12ج34567" },
  );
});

test("buildTransportIntakeForMetadata: passenger may include shareFuelCost", () => {
  assert.deepEqual(
    buildTransportIntakeForMetadata({
      transportMode: RegistrationTransportModeDto.SELF_VEHICLE,
      isDriver: false,
      shareFuelCost: true,
    }),
    { isDriver: false, shareFuelCost: true },
  );
});

test("buildTransportIntakeForMetadata: group_vehicle returns undefined", () => {
  assert.equal(
    buildTransportIntakeForMetadata({
      transportMode: RegistrationTransportModeDto.GROUP_VEHICLE,
      isDriver: true,
    }),
    undefined,
  );
});

test("participantMetadataRecordForPersistence merges peaks and transportIntake", () => {
  const row = participantMetadataRecordForPersistence({
    participantMetadata: { userPastPeaksCount: 2 },
    transportMode: RegistrationTransportModeDto.SELF_VEHICLE,
    isDriver: true,
    plateNumber: "ABC",
  });
  assert.deepEqual(row, {
    userPastPeaksCount: 2,
    transportIntake: { isDriver: true, plateNumber: "ABC" },
  });
});
