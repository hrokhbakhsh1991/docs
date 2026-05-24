import assert from "node:assert/strict";
import test from "node:test";

import { asciiDigitsFromNationalIdRaw, isValidIranNationalIdChecksum } from "@/lib/iran-national-id";

test("iran national id checksum helper accepts 10-digit sample", () => {
  const sample = "1234567891";
  const digits = asciiDigitsFromNationalIdRaw(sample);
  assert.equal(digits.length, 10);
  assert.equal(isValidIranNationalIdChecksum(digits), true);
});
