import test from "node:test";
import assert from "node:assert/strict";

import { asciiDigitsFromNationalIdRaw, validateIranNationalIdChecksum } from "./iran-national-id";

function makeValidNationalId(seed: number[]): string {
  assert.equal(seed.length, 9);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += seed[i]! * (10 - i);
  }
  const r = sum % 11;
  const check = r < 2 ? r : 11 - r;
  return [...seed, check].join("");
}

test("Iran national ID accepts generated valid sample", () => {
  const id = makeValidNationalId([1, 2, 7, 0, 9, 3, 4, 5, 6]);
  assert.equal(validateIranNationalIdChecksum(id), true);
});

test("Iran national ID rejects all-identical digits", () => {
  assert.equal(validateIranNationalIdChecksum("1111111111"), false);
});

test("Iran national ID rejects wrong check digit", () => {
  const id = makeValidNationalId([1, 2, 7, 0, 9, 3, 4, 5, 6]);
  const bad = `${id.slice(0, 9)}${id[9] === "0" ? "9" : "0"}`;
  assert.equal(bad.length, 10);
  assert.equal(validateIranNationalIdChecksum(bad), false);
});

test("asciiDigitsFromNationalIdRaw maps Persian and Arabic digits", () => {
  assert.equal(asciiDigitsFromNationalIdRaw("۲۳۴۸۹۰۱۴۵۷"), "2348901457");
  assert.equal(
    asciiDigitsFromNationalIdRaw("\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669"),
    "123456789"
  );
});
