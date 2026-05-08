import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PhoneSessionDto } from "./phone-session.dto";

test("PhoneSessionDto applies phone normalization and OTP trim", async () => {
  const dto = plainToInstance(PhoneSessionDto, {
    phone: " +98 912 123 6598 ",
    otp: "  1234  "
  });
  const errors = await validate(dto);
  assert.equal(errors.length, 0);
  assert.equal(dto.phone, "+989121236598");
  assert.equal(dto.otp, "1234");
});

test("PhoneSessionDto rejects phone shorter than 8 significant characters after normalize", async () => {
  const dto = plainToInstance(PhoneSessionDto, {
    phone: "+123456",
    otp: "1234"
  });
  const errors = await validate(dto);
  assert.equal(errors.length >= 1, true);
  assert.equal(errors.some((e) => e.property === "phone"), true);
});

test("PhoneSessionDto rejects empty otp", async () => {
  const dto = plainToInstance(PhoneSessionDto, {
    phone: "+15551234567",
    otp: "   "
  });
  const errors = await validate(dto);
  assert.equal(errors.some((e) => e.property === "otp"), true);
});
