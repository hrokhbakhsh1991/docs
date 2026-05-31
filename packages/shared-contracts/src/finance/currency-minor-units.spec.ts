import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CATALOG_CURRENCY_CODE,
  getIso4217MinorUnitExponent,
  majorAmountStringToMinorUnits,
  majorAmountToMinorUnits,
  MajorAmountScaleError,
  normalizeCurrencyCode,
} from "./currency-minor-units";

test("normalizeCurrencyCode defaults to USD when empty", () => {
  assert.equal(normalizeCurrencyCode(undefined), DEFAULT_CATALOG_CURRENCY_CODE);
  assert.equal(normalizeCurrencyCode("  "), DEFAULT_CATALOG_CURRENCY_CODE);
});

test("getIso4217MinorUnitExponent maps common currencies", () => {
  assert.equal(getIso4217MinorUnitExponent("USD"), 2);
  assert.equal(getIso4217MinorUnitExponent("JPY"), 0);
  assert.equal(getIso4217MinorUnitExponent("IRR"), 0);
  assert.equal(getIso4217MinorUnitExponent("KWD"), 3);
  assert.equal(getIso4217MinorUnitExponent("EUR"), 2);
});

test("getIso4217MinorUnitExponent logs and defaults unknown codes to 2", () => {
  /* eslint-disable no-console -- test stubs console.error to assert telemetry */
  const originalError = console.error;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    logs.push(args);
  };
  try {
    assert.equal(getIso4217MinorUnitExponent("XYZ"), 2);
    assert.equal(logs.length, 1);
    assert.match(String(logs[0]?.[0]), /unknown ISO4217 code/);
  } finally {
    console.error = originalError;
  }
  /* eslint-enable no-console */
});

test("majorAmountStringToMinorUnits applies dynamic exponent", () => {
  assert.equal(majorAmountStringToMinorUnits("49.99", "USD"), "4999");
  assert.equal(majorAmountStringToMinorUnits("1200", "JPY"), "1200");
  assert.equal(majorAmountStringToMinorUnits("1200000", "IRR"), "1200000");
  assert.equal(majorAmountStringToMinorUnits("12.345", "KWD"), "12345");
});

test("majorAmountStringToMinorUnits rejects overflow", () => {
  assert.throws(
    () => majorAmountStringToMinorUnits("9223372036854775808", "IRR"),
    (error: unknown) => {
      assert.ok(error instanceof MajorAmountScaleError);
      assert.equal(error.code, "FINANCIAL_NUMERIC_OVERFLOW_LIMIT");
      return true;
    },
  );
});

test("majorAmountToMinorUnits delegates to string helper", () => {
  assert.equal(majorAmountToMinorUnits(49.99, "USD"), 4999);
  assert.equal(majorAmountToMinorUnits(1200, "JPY"), 1200);
  assert.equal(majorAmountToMinorUnits(1_200_000, "IRR"), 1_200_000);
  assert.equal(majorAmountToMinorUnits(12.345, "KWD"), 12345);
});
