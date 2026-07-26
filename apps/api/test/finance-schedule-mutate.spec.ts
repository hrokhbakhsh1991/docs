/**
 * FC-4 — schedule item mutate domain + HTTP wiring (static + unit).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  reschedulePaymentScheduleItem,
  waivePaymentScheduleItem,
  type PaymentScheduleItem,
} from "@app-tour/finance-core";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const BASE_ITEM: PaymentScheduleItem = {
  id: "item-1",
  registrationId: "reg-1",
  sequence: 1,
  label: "Installment 1",
  dueAt: "2026-01-01T00:00:00.000Z",
  amountMinor: "1000",
  paidMinor: "0",
  status: "scheduled",
};

describe("finance-schedule-mutate.spec.ts — FC-4", () => {
  it("API-FC4-01 waive sets status without changing amount sum", () => {
    const next = waivePaymentScheduleItem([BASE_ITEM], "item-1");
    assert.equal(next[0]?.status, "waived");
    assert.equal(next[0]?.amountMinor, "1000");
  });

  it("API-FC4-02 reschedule updates dueAt", () => {
    const next = reschedulePaymentScheduleItem(
      [{ ...BASE_ITEM, status: "overdue" }],
      "item-1",
      "2027-06-01T00:00:00.000Z"
    );
    assert.match(next[0]?.dueAt ?? "", /2027-06-01/);
    assert.equal(next[0]?.status, "scheduled");
  });

  it("API-FC4-03 manifest + handler wire PATCH schedule item route", () => {
    const routes = readFileSync(
      resolve(REPO_ROOT, "packages/finance-http/src/finance.routes.ts"),
      "utf8"
    );
    assert.match(routes, /handleFinancePatchScheduleItem/);
    assert.match(routes, /enqueueScheduleItemWaivedAudit/);
  });
});
