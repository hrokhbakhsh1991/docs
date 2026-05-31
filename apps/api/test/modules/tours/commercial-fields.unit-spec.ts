import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException } from "@nestjs/common";

import {
  currencyCodeFromCostContext,
  listPriceMinorFromCostContext,
} from "../../../src/modules/tours/utils/commercial-fields";

test("listPriceMinorFromCostContext uses USD exponent 2 by default", () => {
  assert.equal(listPriceMinorFromCostContext({ totalCost: "49.99" }), "4999");
});

test("listPriceMinorFromCostContext uses zero exponent for IRR", () => {
  assert.equal(
    listPriceMinorFromCostContext({ totalCost: "1200000", currency: "IRR" }),
    "1200000",
  );
});

test("listPriceMinorFromCostContext uses three-decimal exponent for KWD", () => {
  assert.equal(
    listPriceMinorFromCostContext({ totalCost: "12.345", currency: "KWD" }),
    "12345",
  );
});

test("listPriceMinorFromCostContext rejects fractional totalCost for zero-decimal IRR", () => {
  assert.throws(
    () => listPriceMinorFromCostContext({ totalCost: "1200000.5", currency: "IRR" }),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const body = error.getResponse() as { error?: { code?: string } };
      assert.equal(body.error?.code, "FINANCIAL_NUMERIC_PRECISION_INVALID");
      return true;
    },
  );
});

test("listPriceMinorFromCostContext rejects totalCost above bigint limit for IRR", () => {
  assert.throws(
    () =>
      listPriceMinorFromCostContext({
        totalCost: "9223372036854775808",
        currency: "IRR",
      }),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const body = error.getResponse() as { error?: { code?: string } };
      assert.equal(body.error?.code, "FINANCIAL_NUMERIC_OVERFLOW_LIMIT");
      return true;
    },
  );
});

test("listPriceMinorFromCostContext rejects scaled minor overflow for USD", () => {
  assert.throws(
    () =>
      listPriceMinorFromCostContext({
        totalCost: "9007199254740992",
        currency: "USD",
      }),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const body = error.getResponse() as { error?: { code?: string } };
      assert.equal(body.error?.code, "FINANCIAL_NUMERIC_OVERFLOW_LIMIT");
      return true;
    },
  );
});

test("listPriceMinorFromCostContext tolerates legacy numeric JSONB totalCost", () => {
  assert.equal(listPriceMinorFromCostContext({ totalCost: 49.99 }), "4999");
});

test("currencyCodeFromCostContext prefers cost_context then workspace hint then USD", () => {
  assert.equal(currencyCodeFromCostContext({ currency: "EUR" }), "EUR");
  assert.equal(
    currencyCodeFromCostContext({}, { workspaceCurrencyCode: "IRR" }),
    "IRR",
  );
  assert.equal(currencyCodeFromCostContext({}), "USD");
});
