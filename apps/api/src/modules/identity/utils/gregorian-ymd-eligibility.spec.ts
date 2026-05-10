import test from "node:test";
import assert from "node:assert/strict";

import {
  parseGregorianYmdStrict,
  isBirthDateYmdEligible,
  utcTodayYmd
} from "./gregorian-ymd-eligibility";

test("parseGregorianYmdStrict rejects invalid calendar dates", () => {
  assert.equal(parseGregorianYmdStrict("2023-02-29"), null);
  assert.equal(parseGregorianYmdStrict("not-a-date"), null);
});

test("parseGregorianYmdStrict accepts leap-day", () => {
  assert.deepEqual(parseGregorianYmdStrict("2024-02-29"), { y: 2024, m: 2, d: 29 });
});

test("isBirthDateYmdEligible rejects future and too-old years", () => {
  assert.equal(isBirthDateYmdEligible("1899-12-31"), false);
  const farFuture = utcTodayYmd().replace(/^(\d{4})/, (_, y) => String(Number(y) + 50));
  assert.equal(isBirthDateYmdEligible(farFuture), false);
});
