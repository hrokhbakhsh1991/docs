/**
 * Finance recon foundation — pure helpers + starter gating (no DB).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FINANCE_RECON_CODE, FINANCE_RECON_SEVERITY } from "./codes";
import { sumDebitLinesMinor } from "./detect";
import {
  isFinanceReconEnabled,
  readFinanceReconIntervalMs,
} from "./start-finance-recon";

describe("finance recon codes", () => {
  it("maps every code to a severity", () => {
    for (const code of Object.values(FINANCE_RECON_CODE)) {
      assert.ok(FINANCE_RECON_SEVERITY[code]);
    }
  });

  it("marks paid-without-ledger as critical", () => {
    assert.equal(FINANCE_RECON_SEVERITY[FINANCE_RECON_CODE.paidNoLedger], "critical");
  });
});

describe("sumDebitLinesMinor", () => {
  it("sums debit amount_minor", () => {
    assert.equal(
      sumDebitLinesMinor({
        lines: [
          { side: "debit", amount_minor: "1000" },
          { side: "credit", amount_minor: "1000" },
          { side: "debit", amount_minor: "250" },
        ],
      }),
      1250n
    );
  });

  it("returns null when payload malformed", () => {
    assert.equal(sumDebitLinesMinor(null), null);
    assert.equal(sumDebitLinesMinor({ lines: "x" }), null);
    assert.equal(sumDebitLinesMinor({ lines: [{ side: "debit", amount_minor: "nope" }] }), null);
  });

  it("returns null when no debit lines", () => {
    assert.equal(
      sumDebitLinesMinor({ lines: [{ side: "credit", amount_minor: "1" }] }),
      null
    );
  });
});

describe("startFinanceRecon gating", () => {
  it("defaults on when prisma + DATABASE_URL", () => {
    assert.equal(
      isFinanceReconEnabled({
        STORAGE_DRIVER: "prisma",
        DATABASE_URL: "postgresql://localhost/x",
      }),
      true
    );
  });

  it("respects FINANCE_RECON_ENABLED=false", () => {
    assert.equal(
      isFinanceReconEnabled({
        STORAGE_DRIVER: "prisma",
        DATABASE_URL: "postgresql://localhost/x",
        FINANCE_RECON_ENABLED: "false",
      }),
      false
    );
  });

  it("clamps interval to >= 60s", () => {
    assert.equal(readFinanceReconIntervalMs({ FINANCE_RECON_INTERVAL_MS: "1000" }), 300_000);
    assert.equal(readFinanceReconIntervalMs({ FINANCE_RECON_INTERVAL_MS: "120000" }), 120_000);
  });
});
