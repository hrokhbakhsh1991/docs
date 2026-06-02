import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

import { CreateRegistrationDto, RegistrationTransportModeDto } from "./create-registration.dto";

function dto(partial: Partial<CreateRegistrationDto>): CreateRegistrationDto {
  return plainToInstance(CreateRegistrationDto, {
    tourId: "22222222-2222-4222-8222-222222222222",
    participantFullName: "Ali",
    participantContactPhone: "+989121234567",
    entryMode: "web",
    transportMode: RegistrationTransportModeDto.GROUP_VEHICLE,
    ...partial,
  });
}

test("CreateRegistrationDto: self_vehicle requires isDriver", async () => {
  const errors = await validate(
    dto({
      transportMode: RegistrationTransportModeDto.SELF_VEHICLE,
    }),
  );
  assert.ok(errors.some((e) => e.property === "isDriver"));
});

test("CreateRegistrationDto: driver requires plate and vehicleSeatCapacity", async () => {
  const errors = await validate(
    dto({
      transportMode: RegistrationTransportModeDto.SELF_VEHICLE,
      isDriver: true,
    }),
  );
  const props = new Set(errors.map((e) => e.property));
  assert.ok(props.has("plateNumber"));
  assert.ok(props.has("vehicleSeatCapacity"));
});

test("CreateRegistrationDto: driver with plate and seats passes", async () => {
  const errors = await validate(
    dto({
      transportMode: RegistrationTransportModeDto.SELF_VEHICLE,
      isDriver: true,
      plateNumber: "12ج345",
      vehicleSeatCapacity: 2,
    }),
  );
  assert.equal(errors.length, 0);
});

test("CreateRegistrationDto: group_vehicle ignores private car fields", async () => {
  const errors = await validate(
    dto({
      transportMode: RegistrationTransportModeDto.GROUP_VEHICLE,
      isDriver: true,
      plateNumber: "x",
    }),
  );
  assert.equal(errors.length, 0);
});
