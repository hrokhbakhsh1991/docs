import assert from "node:assert/strict";
import { test } from "node:test";

import { formatWalletBalanceMinor } from "./users-format";

test("formatWalletBalanceMinor: IRR minor rials → Toman with Persian suffix", () => {
  assert.equal(formatWalletBalanceMinor("0", "IRR"), `${(0n).toLocaleString("fa-IR")} تومان`);
  assert.equal(formatWalletBalanceMinor("1000", "IRR"), `+${(100n).toLocaleString("fa-IR")} تومان`);
  assert.equal(formatWalletBalanceMinor("-500", "IRR"), `-${(50n).toLocaleString("fa-IR")} تومان`);
});

test("formatWalletBalanceMinor: USD minor cents → dollar display", () => {
  assert.equal(formatWalletBalanceMinor("12345", "USD"), "$123.45");
  assert.equal(formatWalletBalanceMinor("10000", "USD"), "$100");
  assert.equal(formatWalletBalanceMinor("-250", "USD"), "-$2.50");
});
